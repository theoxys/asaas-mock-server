/**
 * Cartão de crédito — a camada impura: tokenização, resolução de token e o
 * fluxo de cobrança com cartão.
 *
 * DUAS REGRAS DO ASAAS QUE SÃO FÁCEIS DE ERRAR E QUE ESTÃO AQUI:
 *
 * 1. **A cobrança com cartão já nasce CONFIRMED.** A captura acontece no ato da
 *    criação, INDEPENDENTE da `dueDate` — mandar `dueDate` para daqui a 30 dias
 *    não adia nada. O que a `dueDate` faz é... nada, no cartão. O dinheiro
 *    credita em D+32 da confirmação (job `credit-settlement`).
 *
 * 2. **Cartão recusado → HTTP 400 e a cobrança NÃO existe.** Não é uma cobrança
 *    com status "recusado": ela não é criada. E a mensagem é genérica de
 *    propósito — dizer "cartão sem limite" ou "cartão bloqueado" para o lojista
 *    (que repassa ao comprador) é vetor de enumeração de cartão roubado. O Asaas
 *    não diz, e nós também não.
 *
 * O PAN completo nunca chega ao banco: `inspectCard` (puro) devolve só `last4`,
 * bandeira e desfecho. Não há caminho aqui que persista o número.
 */
import { and, eq } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { AsaasError, badRequest, invalid, notFound } from '../../core/errors.ts'
import type { DB } from '../../db/client.ts'
import { creditCards, customers, payments } from '../../db/schema/index.ts'
import {
  CARD_ERRORS,
  CreditCardError,
  declinesOnCharge,
  declinesOnTokenize,
  inspectCard,
  type CardInfo,
  type CardInput,
} from '../../domain/credit-card.ts'
import * as ids from '../../domain/ids.ts'
import { maxInstallmentsForBrand } from '../../domain/installments.ts'
import { applyTransition } from '../payments/apply.ts'
import { serializePayment, type PaymentRow } from '../payments/serializer.ts'
import { createPayment, parseCreateBody } from '../payments/service.ts'

export type CreditCardRow = typeof creditCards.$inferSelect

/**
 * A recusa. Genérica DE PROPÓSITO: o Asaas não diz o motivo — não há campo de
 * razão no corpo, e os dois cartões de recusa devolvem a MESMA frase. Um mock que
 * inventasse "saldo insuficiente" ensinaria o cliente a tratar um erro que a
 * produção nunca manda.
 *
 * Código e frase capturados do sandbox (tools/probe-cards.ts). Antes daqui isto
 * era `invalid_creditCard` com outro texto — inventado, e errado.
 */
export const DECLINED = badRequest(CARD_ERRORS.DECLINE.code, CARD_ERRORS.DECLINE.description)

/** Traduz o erro puro do domínio para o formato de erro do Asaas. */
function toApiError(err: unknown): never {
  if (err instanceof CreditCardError) throw badRequest(err.code, err.description)
  throw err
}

export function inspect(card: CardInput, now: Date): CardInfo {
  try {
    return inspectCard(card, now)
  } catch (err) {
    return toApiError(err)
  }
}

/** `remoteIp` é obrigatório em toda transação de cartão. O Asaas recusa sem ele. */
export function requireRemoteIp(body: Record<string, unknown>): string {
  const ip = String(body.remoteIp ?? '').trim()
  if (!ip) {
    throw invalid(
      'remoteIp',
      'O IP de origem da compra (remoteIp) é obrigatório em transações com cartão de crédito.',
    )
  }
  return ip
}

/** O body traz cartão? (é o que decide entre `create-new-payment` e a variante) */
export function hasCreditCard(body: Record<string, unknown>): boolean {
  return Boolean(body.creditCard) || Boolean(body.creditCardToken)
}

/**
 * Um cartão pronto para uso: já tokenizado (veio `creditCardToken`) ou cru
 * (veio `creditCard`). Em ambos os casos sabemos bandeira, last4 e desfecho —
 * e em nenhum dos dois o PAN sobrevive a esta função.
 */
export interface ResolvedCard {
  info: CardInfo
  /** Preenchido quando veio por token: o cartão já existe no banco. */
  existing: CreditCardRow | null
  /** Preenchido quando veio cru: o que falta para gravar. */
  raw: {
    holderName: string
    expiryMonth: string
    expiryYear: string
    holderInfo: Record<string, unknown> | null
  } | null
}

/**
 * Token não encontrado — ou encontrado, mas de OUTRO cliente. O Asaas não
 * distingue os dois casos: para ele, um token que não é do cliente da cobrança
 * simplesmente "não existe". Capturado (tools/probe-tokenization.ts).
 *
 * Note o código: `invalid_creditCard`, não `invalid_creditCardToken`. E a
 * descrição CARREGA o token — nós devolvíamos uma frase genérica.
 */
const tokenNotFound = (token: string) =>
  badRequest('invalid_creditCard', `CreditCardToken ${token} não encontrado.`)

/**
 * Os campos que o Asaas exige quando um objeto `creditCard` está PRESENTE — e
 * exige mesmo que um `creditCardToken` venha junto. Capturado: mandar
 * `{creditCardToken, creditCard: {ccv}}` devolve QUATRO erros, um por campo que
 * faltou. É a pegadinha do "revalidar o CVV na recompra": o cliente acha que está
 * reforçando a segurança e o Asaas rejeita a requisição inteira.
 */
const REQUIRED_CARD_FIELDS: ReadonlyArray<[key: string, description: string]> = [
  ['holderName', 'Informe o nome do portador.'],
  ['number', 'Informe o número do seu cartão.'],
  ['expiryMonth', 'Informe o mês de vencimento do seu cartão.'],
  ['expiryYear', 'Informe o ano de vencimento do seu cartão.'],
  ['ccv', 'Informe o código de segurança do seu cartão.'],
]

/**
 * Valida a PRESENÇA dos campos e devolve TODOS os erros de uma vez — o Asaas não
 * para no primeiro. Um cliente que só olha `errors[0]` continua funcionando; um
 * que lista os campos faltantes também.
 */
function assertCompleteCard(card: Record<string, any>): void {
  const missing = REQUIRED_CARD_FIELDS.filter(
    ([key]) => String(card[key] ?? '').trim() === '',
  ).map(([, description]) => ({ code: 'invalid_creditCard', description }))

  if (missing.length > 0) throw new AsaasError(400, missing)
}

/**
 * Resolve o cartão do body SEM gravar nada. Puro do ponto de vista do banco
 * (só lê) — é o que permite recusar um cartão sem deixar lixo persistido.
 *
 * `customerId` é o cliente DA COBRANÇA. Ele entra porque, no Asaas, **o token é
 * preso ao cliente que o criou**: usar o token do cliente A para cobrar o B
 * devolve "não encontrado". Sem esse parâmetro, o mock aceitava (e um app que
 * embaralhasse tokens entre clientes só descobriria em produção).
 */
export async function resolveCard(
  ctx: AppContext,
  db: DB,
  accountId: string,
  body: Record<string, any>,
  customerId: string | null,
): Promise<ResolvedCard> {
  const token = body.creditCardToken ? String(body.creditCardToken) : null
  const card = body.creditCard as Record<string, any> | undefined

  // A PRESENÇA da chave `creditCard` manda, mesmo com token junto: o Asaas valida
  // o objeto inteiro. `creditCard: {}` com um token válido é 400, não 200.
  if (card !== undefined) assertCompleteCard(card)

  if (token && card === undefined) {
    const [row] = await db
      .select()
      .from(creditCards)
      .where(and(eq(creditCards.creditCardToken, token), eq(creditCards.accountId, accountId)))
      .limit(1)

    // O token existe, mas é de outro cliente → para o Asaas, não existe.
    if (!row || (row.customerId !== null && row.customerId !== customerId)) {
      throw tokenNotFound(token)
    }

    return {
      info: {
        last4: row.last4,
        brand: row.brand as CardInfo['brand'],
        outcome: row.simulatedOutcome,
      },
      existing: row,
      raw: null,
    }
  }

  if (!card) {
    throw invalid(
      'creditCard',
      'Informe os dados do cartão de crédito (creditCard) ou um creditCardToken.',
    )
  }

  // O `now` do RELÓGIO, não o do sistema: avançar 5 anos no painel tem que expirar
  // um cartão 05/2027, senão a viagem no tempo mente sobre o cartão.
  const info = inspect(
    {
      number: String(card.number ?? ''),
      holderName: card.holderName,
      expiryMonth: card.expiryMonth === undefined ? undefined : String(card.expiryMonth),
      expiryYear: card.expiryYear === undefined ? undefined : String(card.expiryYear),
      ccv: card.ccv === undefined ? undefined : String(card.ccv),
    },
    ctx.clock.now(),
  )

  return {
    info,
    existing: null,
    raw: {
      holderName: String(card.holderName ?? ''),
      expiryMonth: String(card.expiryMonth ?? ''),
      expiryYear: String(card.expiryYear ?? ''),
      holderInfo: (body.creditCardHolderInfo as Record<string, unknown>) ?? null,
    },
  }
}

/**
 * Grava o cartão (ou reaproveita o já tokenizado) e devolve o id da linha.
 * Só o `last4` vai para o banco — o PAN já não existe neste ponto.
 */
export async function persistCard(
  ctx: AppContext,
  db: DB,
  accountId: string,
  customerId: string | null,
  resolved: ResolvedCard,
): Promise<CreditCardRow> {
  if (resolved.existing) return resolved.existing

  const raw = resolved.raw!
  const row: CreditCardRow = {
    id: ids.genericId(ctx.rng),
    accountId,
    customerId,
    creditCardToken: ids.creditCardToken(ctx.rng),
    last4: resolved.info.last4,
    brand: resolved.info.brand,
    holderName: raw.holderName,
    expiryMonth: raw.expiryMonth,
    expiryYear: raw.expiryYear,
    simulatedOutcome: declinesOnCharge(resolved.info.outcome) ? 'DECLINE' : 'APPROVE',
    holderInfo: raw.holderInfo,
    dateCreated: ctx.clock.timestamp(),
  }

  await db.insert(creditCards).values(row)
  return row
}

/** O cliente existe e é desta conta? (isolamento por conta) */
export async function assertOwnedCustomer(
  ctx: AppContext,
  db: DB,
  accountId: string,
  customerId: string,
): Promise<void> {
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.accountId, accountId)))
    .limit(1)
  if (!customer) throw notFound('Cliente')
}

/** `POST /v3/creditCard/tokenizeCreditCard` */
export async function tokenize(
  ctx: AppContext,
  auth: AuthContext,
  body: Record<string, any>,
): Promise<CreditCardRow> {
  requireRemoteIp(body)

  const customerId = String(body.customer ?? '')
  await assertOwnedCustomer(ctx, ctx.db, auth.accountId, customerId)

  const resolved = await resolveCard(ctx, ctx.db, auth.accountId, body, customerId)

  /**
   * A TOKENIZAÇÃO AUTORIZA. Capturado: tokenizar `5184019740373151` (o cartão de
   * recusa) devolve **400 invalid_action** no sandbox real — não um token.
   *
   * Faz sentido: o Asaas faz uma autorização de valor zero para provar que o
   * cartão vive antes de guardá-lo. E muda a feature de "memorizar cartão": o
   * cartão ruim é rejeitado NA HORA de salvar, e não na primeira cobrança, três
   * semanas depois. Nós tokenizávamos qualquer coisa e só recusávamos ao cobrar —
   * o app mostrava "cartão salvo!" e falhava na compra seguinte.
   */
  if (declinesOnTokenize(resolved.info.outcome)) throw DECLINED

  return ctx.db.transaction(async (tx) =>
    persistCard(ctx, tx as unknown as DB, auth.accountId, customerId, resolved),
  )
}

/**
 * A bandeira limita o parcelamento: Visa/Mastercard até 21x, as demais até 12x.
 * (Regra do Asaas, não da adquirente.)
 */
export function assertInstallmentsAllowed(brand: string, count: number): void {
  const max = maxInstallmentsForBrand(brand)
  if (count > max) {
    throw invalid(
      'installmentCount',
      `A bandeira ${brand} aceita no máximo ${max} parcelas no cartão de crédito.`,
    )
  }
}

/**
 * `POST /v3/payments` com cartão — a variante `create-new-payment-with-credit-card`.
 *
 * Aprovado → a cobrança nasce e vai para CONFIRMED na hora (gatilho CONFIRM).
 * `authorizeOnly` → para em AUTHORIZED (gatilho AUTHORIZE), sem crédito.
 * Recusado → 400, e nada é gravado (nem a cobrança, nem o cartão).
 */
export async function createPaymentWithCard(
  ctx: AppContext,
  auth: AuthContext,
  body: Record<string, any>,
): Promise<Record<string, unknown>> {
  const input = parseCreateBody(body)

  if (input.billingType !== 'CREDIT_CARD') {
    throw invalid(
      'billingType',
      'Para pagar com cartão de crédito, billingType deve ser CREDIT_CARD.',
    )
  }

  requireRemoteIp(body)
  await assertOwnedCustomer(ctx, ctx.db, auth.accountId, input.customerId)

  // Resolve (e VALIDA) o cartão antes de gravar coisa alguma.
  const resolved = await resolveCard(ctx, ctx.db, auth.accountId, body, input.customerId)

  // Parcelamento não chega aqui: `create-new-payment` desvia para o fluxo de
  // installments antes de nos chamar. Esta é a porta da cobrança à vista.
  assertInstallmentsAllowed(resolved.info.brand, 1)

  // A recusa acontece ANTES de qualquer escrita: a cobrança não chega a existir.
  if (declinesOnCharge(resolved.info.outcome)) throw DECLINED

  const authorizeOnly = body.authorizeOnly === true
  const on = ctx.clock.today()

  const row = await ctx.db.transaction(async (t) => {
    const tx = t as unknown as DB

    const card = await persistCard(ctx, tx, auth.accountId, input.customerId, resolved)

    const created = await createPayment(ctx, tx, auth.accountId, auth.walletId, {
      ...input,
      creditCardId: card.id,
    })

    /**
     * TODA mudança de status passa por aqui. Nunca `UPDATE payments SET status`.
     * AUTHORIZE → pré-autorização (não credita).
     * CONFIRM   → capturado agora; credita em D+32 pelo scheduler.
     */
    const r = await applyTransition(
      ctx,
      created.id,
      authorizeOnly ? { kind: 'AUTHORIZE' } : { kind: 'CONFIRM', on },
      tx,
    )

    return r.payment
  })

  return serializePayment(ctx.db, row)
}

/**
 * `POST /v3/payments/{id}/payWithCreditCard` e `/payWithCard` — pagar uma
 * cobrança QUE JÁ EXISTE com cartão.
 *
 * Repare no `billingType`: uma cobrança criada como UNDEFINED (ou boleto) e paga
 * no cartão VIRA uma cobrança de cartão — e por isso a taxa cobrada passa a ser
 * a do cartão e o crédito vai para D+32. Isso é uma mudança de `billingType`,
 * não de status: continua sendo `applyTransition` quem move o status.
 */
export async function payExistingWithCard(
  ctx: AppContext,
  auth: AuthContext,
  paymentId: string,
  body: Record<string, any>,
): Promise<Record<string, unknown>> {
  const [payment] = await ctx.db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.accountId, auth.accountId)))
    .limit(1)

  if (!payment) throw notFound('Cobrança')
  if (payment.deleted) {
    throw badRequest('invalid_action', 'Não é possível pagar uma cobrança removida.')
  }

  const resolved = await resolveCard(ctx, ctx.db, auth.accountId, body, payment.customerId)
  if (declinesOnCharge(resolved.info.outcome)) throw DECLINED

  const on = ctx.clock.today()

  const row = await ctx.db.transaction(async (t) => {
    const tx = t as unknown as DB

    const card = await persistCard(ctx, tx, auth.accountId, payment.customerId, resolved)

    // billingType e creditCardId — NÃO status. O status é do applyTransition.
    await tx
      .update(payments)
      .set({ billingType: 'CREDIT_CARD', creditCardId: card.id })
      .where(eq(payments.id, payment.id))

    const r = await applyTransition(ctx, payment.id, { kind: 'CONFIRM', on }, tx)
    return r.payment as PaymentRow
  })

  return serializePayment(ctx.db, row)
}
