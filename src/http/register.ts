/**
 * Registro de rotas dirigido pelo MANIFESTO.
 *
 * As 213 operações da spec do Asaas são montadas iterando `OPERATIONS`. Um
 * operationId sem handler ganha automaticamente um `notImplemented`.
 *
 * Consequência que é o ponto todo: "as 213 rotas existem" é INVARIANTE DE BUILD,
 * não um checklist num documento. Não dá para esquecer de registrar uma rota, e
 * a cobertura (`GET /_admin/coverage`) é computada, nunca mantida à mão.
 */
import { OptionalKind, Type, type TSchema } from '@sinclair/typebox'
import type { Elysia } from 'elysia'
import type { AppContext, AuthContext } from '../core/context.ts'
import { notImplemented } from '../core/errors.ts'
import {
  getOperation,
  OPERATIONS,
  type OperationId,
  type OperationMeta,
} from '../generated/operations.ts'

export interface HandlerArgs {
  ctx: AppContext
  auth: AuthContext
  params: Record<string, string>
  query: Record<string, unknown>
  body: unknown
  headers: Record<string, string | undefined>
  operation: OperationMeta
}

export type OpHandler = (args: HandlerArgs) => Promise<unknown> | unknown

export type HandlerMap = Partial<Record<OperationId, OpHandler>>

export interface RegisterResult {
  implemented: OperationId[]
  stubbed: OperationId[]
  /** Operações que dividem rota com outra — não registram rota própria. */
  variants: OperationId[]
}

/**
 * O body de uma operação canônica MAIS o das suas variantes.
 *
 * Isto não é um detalhe: o Elysia REMOVE do body toda propriedade que não está
 * no schema. `POST /v3/payments` é registrado com o schema de
 * `create-new-payment` — que não conhece `creditCard`, `creditCardToken`,
 * `remoteIp` nem `authorizeOnly`. Sem a mesclagem, o handler canônico receberia
 * um body já podado e NUNCA veria o cartão: a variante
 * `create-new-payment-with-credit-card` seria inatingível, em silêncio.
 *
 * No Asaas real é um endpoint só, e o body decide. Aqui o schema é a união dos
 * dois: os campos que só existem na variante entram como OPCIONAIS (senão
 * `remoteIp`, obrigatório na variante do cartão, passaria a ser exigido de uma
 * cobrança de boleto). Quem exige o que é o handler — que é quem sabe se o body
 * é de cartão ou não.
 */
function mergeVariantBodies(op: OperationMeta, variants: OperationMeta[]): TSchema | undefined {
  const base = op.body as (TSchema & { properties?: Record<string, TSchema> }) | undefined
  if (!base?.properties || op.bodyContentType !== 'application/json') return op.body

  const properties: Record<string, TSchema> = { ...base.properties }
  let merged = false

  for (const variant of variants) {
    const vb = variant.body as (TSchema & { properties?: Record<string, TSchema> }) | undefined
    if (!vb?.properties || variant.bodyContentType !== 'application/json') continue

    for (const [name, schema] of Object.entries(vb.properties)) {
      if (name in properties) continue
      properties[name] = Type.Optional(schema)
      merged = true
    }
  }

  return merged ? Type.Object(properties) : op.body
}

/**
 * A query string é SEMPRE texto: `?limit=10` chega como `"10"`.
 *
 * A spec declara esses parâmetros como `integer`/`number`/`boolean`, e o TypeBox
 * recusa `"10"` onde espera `10`. Sem isto, `GET /v3/financialTransactions?limit=10`
 * — uma requisição que o Asaas real aceita sem pestanejar — devolveria
 * 400 "Expected integer". É o pior tipo de defeito possível num simulador: ele
 * rejeitando o que a API de verdade aceita.
 *
 * Afrouxamos SÓ o schema de query, aceitando também a forma textual. A conversão
 * e a validação de faixa continuam no handler (`paginationParams`), que é onde o
 * erro sabe virar `invalid_limit` com descrição em pt-BR — em vez do "Expected
 * integer" cru do validador.
 */
function coerceQuerySchema(query: TSchema): TSchema {
  const props = (query as TSchema & { properties?: Record<string, TSchema> }).properties
  if (!props) return query

  const out: Record<string, TSchema> = {}
  let changed = false

  for (const [name, prop] of Object.entries(props)) {
    const p = prop as TSchema & { type?: string }
    const scalar = p.type === 'integer' || p.type === 'number' || p.type === 'boolean'

    if (!scalar) {
      out[name] = prop
      continue
    }

    const union = Type.Union([prop, Type.String()])
    const optional = (prop as unknown as Record<symbol, unknown>)[OptionalKind] === 'Optional'
    out[name] = optional ? Type.Optional(union) : union
    changed = true
  }

  return changed ? Type.Object(out) : query
}

export function registerOperations(
  app: Elysia,
  ctx: AppContext,
  handlers: HandlerMap,
): RegisterResult {
  const implemented: OperationId[] = []
  const stubbed: OperationId[] = []
  const variants: OperationId[] = []

  /** canônica → variantes que dividem rota com ela. */
  const variantsOf = new Map<string, OperationMeta[]>()
  for (const id of Object.keys(OPERATIONS) as OperationId[]) {
    // `getOperation` e não `OPERATIONS[id]`: indexar o objeto `as const` devolve
    // a união dos 213 tipos literais, e os membros sem `variantOf` não têm a
    // propriedade — o acesso não compila.
    const op = getOperation(id)
    if (!op.variantOf) continue
    const list = variantsOf.get(op.variantOf) ?? []
    list.push(op)
    variantsOf.set(op.variantOf, list)
  }

  for (const id of Object.keys(OPERATIONS) as OperationId[]) {
    const op: OperationMeta = OPERATIONS[id]

    // Variante de outra operação (mesmo método+rota). Quem atende é a canônica,
    // que decide pelo body — igual ao Asaas real.
    if (op.variantOf) {
      variants.push(id)
      continue
    }

    const handler = handlers[id]

    if (handler) implemented.push(id)
    else stubbed.push(id)

    const run = handler ?? (() => {
      throw notImplemented(id)
    })

    const schema: Record<string, unknown> = {}
    if (op.query) schema.query = coerceQuerySchema(op.query)
    // multipart não passa por validação de schema: o corpo chega como FormData
    // com File dentro, e o TypeBox do JSON não descreve isso.
    if (op.body && op.bodyContentType === 'application/json') {
      schema.body = mergeVariantBodies(op, variantsOf.get(id) ?? [])
    }

    // Deliberadamente NÃO validamos a resposta em produção: um campo a mais na
    // nossa serialização não deve derrubar a requisição do usuário. A validação
    // de contrato roda nos testes, onde é para quebrar. (tests/helpers/harness)

    const paramNames = op.paramNames ?? []

    const elysiaHandler = (c: any) => {
      // O router entrega :p0, :p1… (normalizados por posição). Traduzimos de
      // volta para os nomes da spec, para que o handler veja `params.imageId`.
      const params: Record<string, string> = {}
      paramNames.forEach((name, i) => {
        params[name] = c.params?.[`p${i}`]
      })

      return run({
        ctx,
        auth: c.auth as AuthContext,
        params,
        query: (c.query ?? {}) as Record<string, unknown>,
        body: c.body,
        headers: c.headers as Record<string, string | undefined>,
        operation: op,
      })
    }

    // O tipo de `app[method]` é uma união de sobrecargas por rota; o registro é
    // dinâmico por natureza. A tipagem forte vive na fronteira do handler.
    const register = (app as any)[op.method].bind(app)
    register(op.path, elysiaHandler, schema)
  }

  return { implemented, stubbed, variants }
}
