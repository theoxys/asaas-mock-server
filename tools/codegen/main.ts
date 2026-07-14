/**
 * Codegen: spec OpenAPI do Asaas → TypeBox + manifesto de operações.
 *
 *   bun run codegen
 *
 * O que sai daqui (tudo em src/generated/, tudo commitado, nada editado à mão):
 *
 *   enums.ts        Os 173 enums da spec, DEDUPLICADOS pelo conjunto de valores.
 *                   (O Asaas emite um schema de enum por operação: existem 7
 *                   "PaymentStatus" diferentes com valores idênticos.)
 *   schemas/*.ts    TypeBox, um arquivo por tag + common.ts para o compartilhado.
 *   operations.ts   O MANIFESTO das 213 operações. É a espinha do projeto: as
 *                   rotas são registradas iterando ele, e todo operationId sem
 *                   handler cai num notImplemented automático. Assim "as 213
 *                   rotas existem" é invariante de build, não checklist.
 */
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  applyOverlays,
  eachOperation,
  HTTP_METHODS,
  readSpec,
  stableStringify,
  type HttpMethod,
  type OpenApiSpec,
} from '../spec.ts'

const OUT = join(import.meta.dir, '..', '..', 'src', 'generated')
const BANNER = `// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json
`

// ───────────────────────────────────────────────────────────── nomes

/** PaymentGetResponseDTO → PaymentGetResponse. Mantém rastreabilidade com a spec. */
function schemaName(raw: string): string {
  return raw.endsWith('DTO') ? raw.slice(0, -3) : raw
}

/**
 * Deriva o nome canônico de um enum removendo o contexto da operação:
 *   PaymentGetResponsePaymentStatus      → PaymentStatus
 *   PaymentListRequestPaymentStatus      → PaymentStatus
 *   WebhookConfigSaveRequestWebhookEvent → WebhookEvent
 * Os que não têm Request/Response no nome ficam com o nome inteiro.
 */
function enumNameCandidate(raw: string): string {
  const stripped = raw.replace(/^.*?(?:Response|Request)/, '')
  return stripped.length > 0 ? stripped : raw
}

/** Tag "Payment with summary data" → "payment-with-summary-data" */
function tagToFile(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function tagToIdent(tag: string): string {
  return tagToFile(tag).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

// ───────────────────────────────────────────────────────────── carga

const rawSpec = await readSpec()
const { spec, applied } = applyOverlays(rawSpec)
console.log(`Overlays aplicados: ${applied.join(', ') || '(nenhum)'}`)

const SCHEMAS = spec.components.schemas as Record<string, any>

// ───────────────────────────────────────────────────────────── enums: dedup

interface EnumGroup {
  name: string
  values: string[]
  /** nomes originais na spec que colapsaram neste grupo */
  aliases: string[]
}

const byValueSet = new Map<string, string[]>()
for (const [name, schema] of Object.entries(SCHEMAS)) {
  if (!Array.isArray(schema.enum)) continue
  const key = stableStringify([...schema.enum].sort())
  const list = byValueSet.get(key) ?? []
  list.push(name)
  byValueSet.set(key, list)
}

const enumGroups: EnumGroup[] = []
const takenEnumNames = new Set<string>()

// Dois conjuntos de valores DIFERENTES podem derivar o mesmo nome canônico — e
// derivam: "PaymentStatus" sai tanto do enum de 14 valores (o status de cobrança
// de verdade) quanto de um enum de 4 valores usado só no filtro de estatísticas.
// Quem tem mais aliases é o conceito principal e fica com o nome curto; o
// perdedor cai para seu nome original, que é único por construção.
const candidateGroups = [...byValueSet.values()]
  .map((aliases) => ({
    aliases,
    values: SCHEMAS[aliases[0]!].enum as string[],
    candidate: [...aliases]
      .map(enumNameCandidate)
      .sort((a, b) => a.length - b.length || a.localeCompare(b))[0]!,
  }))
  .sort(
    (a, b) =>
      b.aliases.length - a.aliases.length ||
      a.candidate.localeCompare(b.candidate) ||
      a.aliases[0]!.localeCompare(b.aliases[0]!),
  )

for (const g of candidateGroups) {
  let name = g.candidate
  if (takenEnumNames.has(name)) {
    name = [...g.aliases].sort((a, b) => a.length - b.length || a.localeCompare(b))[0]!
  }
  if (takenEnumNames.has(name)) throw new Error(`Colisão de nome de enum irreparável: ${name}`)
  takenEnumNames.add(name)
  enumGroups.push({ name, values: g.values, aliases: g.aliases })
}
enumGroups.sort((a, b) => a.name.localeCompare(b.name))

/** nome original da spec → nome canônico do enum */
const enumAliasMap = new Map<string, string>()
for (const g of enumGroups) for (const a of g.aliases) enumAliasMap.set(a, g.name)

console.log(
  `Enums: ${enumAliasMap.size} na spec → ${enumGroups.length} canônicos ` +
    `(${enumAliasMap.size - enumGroups.length} duplicatas colapsadas)`,
)

// ───────────────────────────────────────────────────────────── grafo de refs

const isEnum = (n: string) => enumAliasMap.has(n)

function refsOf(node: any, out = new Set<string>()): Set<string> {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const n of node) refsOf(n, out)
    return out
  }
  if (typeof node.$ref === 'string') {
    const name = node.$ref.split('/').pop()!
    out.add(name)
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === '$ref') continue
    refsOf(v, out)
  }
  return out
}

/** fecho transitivo de refs a partir de um schema */
function reachable(start: Iterable<string>): Set<string> {
  const seen = new Set<string>()
  const stack = [...start]
  while (stack.length) {
    const name = stack.pop()!
    if (seen.has(name) || !SCHEMAS[name]) continue
    seen.add(name)
    for (const r of refsOf(SCHEMAS[name])) stack.push(r)
  }
  return seen
}

// ───────────────────────────────────────────────────────────── operações

interface Op {
  operationId: string
  tag: string
  method: HttpMethod
  specPath: string
  elysiaPath: string
  /** Preenchido quando esta operação divide rota com outra (ver normalização abaixo). */
  variantOf?: string
  summary?: string
  pathParams: { name: string; schema: any }[]
  queryParams: { name: string; schema: any; required: boolean }[]
  bodyRef?: string
  bodyContentType?: 'application/json' | 'multipart/form-data'
  responses: { status: number; ref?: string }[]
}

const ops: Op[] = []
const seenOpIds = new Set<string>()

for (const { path: rawPath, method, op } of eachOperation(spec)) {
  if (!op.operationId) throw new Error(`Operação sem operationId: ${method} ${rawPath}`)
  if (seenOpIds.has(op.operationId)) {
    throw new Error(`operationId duplicado na spec: ${op.operationId}`)
  }
  seenOpIds.add(op.operationId)

  /**
   * A spec tem 13 paths com BARRA FINAL espúria. Em 5 deles existe um gêmeo sem
   * barra e mesmo método:
   *
   *   POST /v3/payments    → criar cobrança
   *   POST /v3/payments/   → criar cobrança com cartão de crédito
   *
   * No Asaas real isso é UM endpoint só — a barra é artefato da documentação,
   * usada para separar duas páginas. Pior: o segmento vazio corrompe o nó da
   * árvore de rotas e derruba o GET vizinho.
   *
   * Normalizamos a barra. As duas operationIds continuam no manifesto (o cliente
   * pode chamar qualquer uma), mas só a canônica registra rota — a variante é
   * marcada com `variantOf`, e o handler decide pelo body, como o Asaas faz.
   */
  const path = rawPath.length > 1 ? rawPath.replace(/\/$/, '') : rawPath

  const tag = op.tags?.[0] ?? 'Untagged'
  const params = op.parameters ?? []

  const bodyContent = op.requestBody?.content ?? {}
  const bodyContentType = ('application/json' in bodyContent
    ? 'application/json'
    : 'multipart/form-data' in bodyContent
      ? 'multipart/form-data'
      : undefined) as Op['bodyContentType']
  const bodySchema = bodyContentType ? bodyContent[bodyContentType]?.schema : undefined

  const responses: Op['responses'] = []
  for (const [status, res] of Object.entries(op.responses ?? {})) {
    const code = Number(status)
    if (!Number.isFinite(code)) continue
    const schema = (res as any)?.content?.['application/json']?.schema
    responses.push({ status: code, ref: schema?.$ref?.split('/').pop() })
  }

  /**
   * Os nomes de parâmetro da spec COLIDEM entre rotas irmãs:
   *   /v3/paymentLinks/{id}/images
   *   /v3/paymentLinks/{paymentLinkId}/images/{imageId}
   * O router recusa dois nomes diferentes na mesma posição. Normalizamos para
   * :p0, :p1… e guardamos os nomes reais em `paramNames` — o register remapeia
   * antes de chamar o handler, que continua vendo `params.paymentLinkId`.
   */
  let paramIndex = 0
  const elysiaPath = path.replace(/\{[^}]+\}/g, () => `:p${paramIndex++}`)

  ops.push({
    operationId: op.operationId,
    tag,
    method,
    specPath: path,
    elysiaPath,
    summary: op.summary,
    pathParams: params
      .filter((p: any) => p.in === 'path')
      .map((p: any) => ({ name: p.name, schema: p.schema })),
    queryParams: params
      .filter((p: any) => p.in === 'query')
      .map((p: any) => ({ name: p.name, schema: p.schema, required: !!p.required })),
    bodyRef: bodySchema?.$ref?.split('/').pop(),
    bodyContentType,
    responses: responses.sort((a, b) => a.status - b.status),
    // usado só abaixo, para escolher a operação canônica de cada rota
    ...({ hadTrailingSlash: rawPath.length > 1 && rawPath.endsWith('/') } as object),
  })
}
ops.sort((a, b) => a.operationId.localeCompare(b.operationId))

// Marca as variantes que dividem rota com outra operação.
const byRoute = new Map<string, Op[]>()
for (const op of ops) {
  const key = `${op.method} ${op.elysiaPath}`
  byRoute.set(key, [...(byRoute.get(key) ?? []), op])
}
let variantCount = 0
for (const [key, group] of byRoute) {
  if (group.length === 1) continue
  // A canônica é a que NÃO tinha barra final na spec.
  const canonical =
    group.find((o) => !(o as unknown as { hadTrailingSlash: boolean }).hadTrailingSlash) ??
    group[0]!
  for (const op of group) {
    if (op === canonical) continue
    op.variantOf = canonical.operationId
    variantCount++
    console.log(`  variante: ${op.operationId}\n            divide "${key}" com ${canonical.operationId}`)
  }
}
if (variantCount) console.log(`Rotas compartilhadas: ${variantCount} variantes\n`)

const tags = [...new Set(ops.map((o) => o.tag))].sort()
console.log(`Operações: ${ops.length} em ${tags.length} tags`)

// ───────────────────────────────────────────────────────────── particionamento

// Quais schemas cada tag alcança. Alcançado por 1 tag → vive no arquivo da tag.
// Alcançado por 2+ → common.ts. Isso garante que nenhum arquivo de tag precise
// importar de outro arquivo de tag (sem import cíclico entre tags).
const tagsOfSchema = new Map<string, Set<string>>()

for (const op of ops) {
  const roots = new Set<string>()
  if (op.bodyRef) roots.add(op.bodyRef)
  for (const r of op.responses) if (r.ref) roots.add(r.ref)
  for (const p of [...op.pathParams, ...op.queryParams]) {
    for (const r of refsOf(p.schema)) roots.add(r)
  }
  for (const name of reachable(roots)) {
    if (isEnum(name)) continue
    const set = tagsOfSchema.get(name) ?? new Set()
    set.add(op.tag)
    tagsOfSchema.set(name, set)
  }
}

const fileOfSchema = new Map<string, string>() // nome do schema → 'common' | tagFile
for (const name of Object.keys(SCHEMAS)) {
  if (isEnum(name)) continue
  const owners = tagsOfSchema.get(name)
  if (!owners || owners.size !== 1) {
    fileOfSchema.set(name, 'common') // órfão ou compartilhado
  } else {
    fileOfSchema.set(name, tagToFile([...owners][0]!))
  }
}

const grouped = new Map<string, string[]>()
for (const [name, file] of fileOfSchema) {
  const list = grouped.get(file) ?? []
  list.push(name)
  grouped.set(file, list)
}

// ───────────────────────────────────────────────────────────── emissor TypeBox

/**
 * A spec NUNCA declara `nullable`, mas a API do Asaas devolve `null` em dezenas
 * de campos (originalValue, paymentDate, creditCard…). Validar response ao pé da
 * letra rejeitaria resposta legítima. Regra: campo `required` é estrito; campo
 * opcional aceita null. Ainda pega tipo errado, enum inválido e campo faltando —
 * que é o que a validação de contrato precisa pegar.
 */
function emit(schema: any, currentFile: string, indent = 2): string {
  const pad = ' '.repeat(indent)

  if (schema.$ref) {
    const raw = schema.$ref.split('/').pop()!
    if (isEnum(raw)) return enumAliasMap.get(raw)!
    return schemaName(raw)
  }

  const opts: string[] = []
  if (schema.description) opts.push(`description: ${JSON.stringify(schema.description)}`)
  if (schema.example !== undefined) opts.push(`examples: [${JSON.stringify(schema.example)}]`)
  const withOpts = (expr: string) => {
    if (!opts.length) return expr
    const o = `{ ${opts.join(', ')} }`
    return expr.endsWith('()') ? `${expr.slice(0, -1)}${o})` : `${expr.slice(0, -1)}, ${o})`
  }

  /**
   * ATENÇÃO À ORDEM: `type` é testado ANTES de `enum`.
   *
   * A spec do Asaas tem campos declarados como `type: 'array'` que TAMBÉM
   * carregam um `enum` no nível do array (o enum correto já está em
   * `items.$ref`). Ex.: `events` do webhook, `billingTypes` do checkout.
   *
   * Se testássemos `enum` primeiro, esses campos virariam `Type.Union([…])` — um
   * valor único em vez de uma lista — e a validação de contrato rejeitaria uma
   * resposta perfeitamente legítima. Foi um bug real, encontrado pelo track B.
   */
  if (schema.type === undefined && Array.isArray(schema.enum)) {
    const vals = schema.enum.map((v: string) => `Type.Literal(${JSON.stringify(v)})`)
    return `Type.Union([${vals.join(', ')}])`
  }

  if (schema.type === 'string' && Array.isArray(schema.enum)) {
    const vals = schema.enum.map((v: string) => `Type.Literal(${JSON.stringify(v)})`)
    return `Type.Union([${vals.join(', ')}])`
  }

  switch (schema.type) {
    case 'string':
      if (schema.format === 'binary') return 'Type.Any()'
      return withOpts('Type.String()')
    case 'integer':
      return withOpts('Type.Integer()')
    case 'number':
      return withOpts('Type.Number()')
    case 'boolean':
      return withOpts('Type.Boolean()')
    case 'array':
      return `Type.Array(${emit(schema.items ?? {}, currentFile, indent)})`
    case 'object':
    case undefined: {
      const props = schema.properties as Record<string, any> | undefined
      if (!props) return 'Type.Any()'
      const required = new Set<string>(schema.required ?? [])
      const lines: string[] = []
      for (const [key, prop] of Object.entries(props)) {
        const inner = emit(prop, currentFile, indent + 2)
        const wrapped = required.has(key) ? inner : `Type.Optional(Nullable(${inner}))`
        lines.push(`${pad}  ${JSON.stringify(key)}: ${wrapped},`)
      }
      if (!lines.length) return 'Type.Object({})'
      return `Type.Object({\n${lines.join('\n')}\n${pad}})`
    }
    default:
      return 'Type.Any()'
  }
}

/** Ordena declarações por dependência — TypeBox usa `const`, precisa declarar antes de usar. */
function topoSort(names: string[], file: string): string[] {
  const inFile = new Set(names)
  const state = new Map<string, 'visiting' | 'done'>()
  const out: string[] = []

  const visit = (name: string, trail: string[]) => {
    if (state.get(name) === 'done') return
    if (state.get(name) === 'visiting') {
      throw new Error(
        `Ciclo de referência em ${file}: ${[...trail, name].join(' → ')}.\n` +
          `TypeBox precisaria de Type.Recursive aqui — o codegen não suporta ainda.`,
      )
    }
    state.set(name, 'visiting')
    for (const dep of refsOf(SCHEMAS[name])) {
      if (inFile.has(dep)) visit(dep, [...trail, name])
    }
    state.set(name, 'done')
    out.push(name)
  }

  for (const n of [...names].sort()) visit(n, [])
  return out
}

// ───────────────────────────────────────────────────────────── escrita

rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'schemas'), { recursive: true })

// enums.ts
{
  const lines = [BANNER, `import { Type } from '@sinclair/typebox'`, '']
  for (const g of enumGroups) {
    if (g.aliases.length > 1) {
      lines.push(`/** Colapsa ${g.aliases.length} schemas idênticos da spec. */`)
    }
    const vals = g.values.map((v) => `  Type.Literal(${JSON.stringify(v)}),`).join('\n')
    lines.push(`export const ${g.name} = Type.Union([\n${vals}\n])`)
    lines.push(`export type ${g.name} = (typeof ${g.name})['static']`)
    lines.push('')
  }
  await Bun.write(join(OUT, 'enums.ts'), lines.join('\n'))
}

// schemas/*.ts
const enumNamesUsedBy = (names: string[]): string[] => {
  const used = new Set<string>()
  for (const n of names) {
    for (const r of refsOf(SCHEMAS[n])) {
      const canon = enumAliasMap.get(r)
      if (canon) used.add(canon)
    }
  }
  return [...used].sort()
}

for (const [file, names] of [...grouped].sort()) {
  const ordered = topoSort(names, file)
  const usedEnums = enumNamesUsedBy(names)

  // quais schemas deste arquivo referenciam algo de common?
  const commonDeps = new Set<string>()
  if (file !== 'common') {
    for (const n of names) {
      for (const r of refsOf(SCHEMAS[n])) {
        if (!isEnum(r) && fileOfSchema.get(r) === 'common') commonDeps.add(schemaName(r))
      }
    }
  }

  const imports = [`import { Type } from '@sinclair/typebox'`, `import { Nullable } from '../nullable.ts'`]
  if (usedEnums.length) {
    imports.push(`import { ${usedEnums.join(', ')} } from '../enums.ts'`)
  }
  if (commonDeps.size) {
    imports.push(`import { ${[...commonDeps].sort().join(', ')} } from './common.ts'`)
  }

  const decls = ordered.map((n) => {
    const id = schemaName(n)
    const desc = SCHEMAS[n].description
    const doc = desc ? `/** ${String(desc).replace(/\*\//g, '*\\/')} */\n` : ''
    return `${doc}export const ${id} = ${emit(SCHEMAS[n], file)}\nexport type ${id} = (typeof ${id})['static']\n`
  })

  await Bun.write(
    join(OUT, 'schemas', `${file}.ts`),
    [BANNER, ...imports, '', ...decls].join('\n'),
  )
}

// nullable.ts
await Bun.write(
  join(OUT, 'nullable.ts'),
  `${BANNER}
import { Type, type TSchema } from '@sinclair/typebox'

/**
 * A spec do Asaas não declara \`nullable\` em lugar nenhum, mas a API devolve
 * \`null\` em dezenas de campos (originalValue, paymentDate, creditCard, split…).
 * Todo campo opcional é envelopado aqui para que a validação de contrato não
 * rejeite uma resposta legítima. Campos \`required\` continuam estritos.
 */
export const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()])
`,
)

// operations.ts
{
  const importsByFile = new Map<string, Set<string>>()
  const needEnums = new Set<string>()
  const ref = (raw: string | undefined): string | null => {
    if (!raw) return null
    if (isEnum(raw)) {
      const c = enumAliasMap.get(raw)!
      needEnums.add(c)
      return c
    }
    const file = fileOfSchema.get(raw)
    if (!file) return null
    const set = importsByFile.get(file) ?? new Set()
    set.add(schemaName(raw))
    importsByFile.set(file, set)
    return schemaName(raw)
  }

  /** params/query passam direto pelo emit(), que resolve $ref sem registrar o
   *  import. Sem isto, um enum usado só em filtro de query sai como identificador
   *  não declarado. */
  const noteEnums = (schema: unknown) => {
    for (const r of refsOf(schema)) {
      const canon = enumAliasMap.get(r)
      if (canon) needEnums.add(canon)
    }
  }

  const entries: string[] = []
  for (const op of ops) {
    for (const p of [...op.pathParams, ...op.queryParams]) noteEnums(p.schema)

    const parts: string[] = [
      `    operationId: ${JSON.stringify(op.operationId)}`,
      `    tag: ${JSON.stringify(op.tag)}`,
      `    method: ${JSON.stringify(op.method)}`,
      `    specPath: ${JSON.stringify(op.specPath)}`,
      `    path: ${JSON.stringify(op.elysiaPath)}`,
    ]
    if (op.summary) parts.push(`    summary: ${JSON.stringify(op.summary)}`)
    if (op.variantOf) parts.push(`    variantOf: ${JSON.stringify(op.variantOf)}`)

    // Nomes reais dos parâmetros, NA ORDEM em que aparecem no path. O router usa
    // :p0/:p1; o register traduz de volta usando esta lista.
    const pathParamNames = [...op.specPath.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!)
    if (pathParamNames.length) {
      parts.push(`    paramNames: ${JSON.stringify(pathParamNames)}`)
    }
    if (op.queryParams.length) {
      const props = op.queryParams
        .map((p) => {
          const inner = emit(p.schema ?? {}, 'operations', 6)
          // Query string chega como string; números e booleanos vêm coagidos pelo
          // Elysia, mas campos opcionais podem simplesmente não vir.
          return `      ${JSON.stringify(p.name)}: ${p.required ? inner : `Type.Optional(${inner})`},`
        })
        .join('\n')
      parts.push(`    query: Type.Object({\n${props}\n    })`)
    }
    if (op.bodyRef) {
      const name = ref(op.bodyRef)
      if (name) {
        parts.push(`    body: ${name}`)
        parts.push(`    bodyContentType: ${JSON.stringify(op.bodyContentType)}`)
      }
    }

    const resEntries = op.responses
      .map((r) => {
        const name = ref(r.ref)
        return `      ${r.status}: ${name ?? 'undefined'},`
      })
      .join('\n')
    parts.push(`    responses: {\n${resEntries}\n    }`)

    entries.push(`  ${JSON.stringify(op.operationId)}: {\n${parts.join(',\n')},\n  },`)
  }

  const imports = [
    `import { Type, type TSchema } from '@sinclair/typebox'`,
    ...[...importsByFile]
      .sort()
      .map(
        ([file, names]) =>
          `import { ${[...names].sort().join(', ')} } from './schemas/${file}.ts'`,
      ),
  ]
  if (needEnums.size) {
    imports.push(`import { ${[...needEnums].sort().join(', ')} } from './enums.ts'`)
  }

  const body = `${BANNER}
${imports.join('\n')}

export type HttpMethod = ${HTTP_METHODS.map((m) => JSON.stringify(m)).join(' | ')}

export interface OperationMeta {
  operationId: string
  tag: string
  method: HttpMethod
  /** Caminho como está na spec: /v3/payments/{id} */
  specPath: string
  /**
   * Caminho para o router, com parâmetros normalizados por posição:
   * /v3/payments/:p0. Necessário porque a spec usa nomes diferentes na mesma
   * posição em rotas irmãs, e o router recusa.
   */
  path: string
  summary?: string
  /**
   * Esta operação divide método+rota com outra (a spec as separou com uma barra
   * final espúria; no Asaas real é o mesmo endpoint, e o body decide o
   * comportamento — ex.: criar cobrança COM ou SEM cartão).
   * Só a canônica registra rota; a variante existe no manifesto para que o
   * cliente possa referenciá-la pelo operationId da documentação.
   */
  variantOf?: string
  /** Nomes reais dos parâmetros, na ordem do path. :p0 → paramNames[0]. */
  paramNames?: readonly string[]
  query?: TSchema
  body?: TSchema
  bodyContentType?: 'application/json' | 'multipart/form-data'
  responses: Record<number, TSchema | undefined>
}

export const OPERATIONS = {
${entries.join('\n')}
} as const satisfies Record<string, OperationMeta>

export type OperationId = keyof typeof OPERATIONS

export const OPERATION_IDS = Object.keys(OPERATIONS) as OperationId[]

/**
 * Acessor tipado. \`OPERATIONS[id]\` devolve o tipo literal exato daquela
 * operação (útil), mas quando você itera sobre todas ele vira uma união de 213
 * membros e o TS não deixa acessar campos opcionais. Use isto para iterar.
 */
export const getOperation = (id: OperationId): OperationMeta => OPERATIONS[id] as OperationMeta

/** Total de operações na spec do Asaas. A cobertura é medida contra isto. */
export const OPERATION_COUNT = ${ops.length}

export const TAGS = ${JSON.stringify(tags, null, 2)} as const
`
  await Bun.write(join(OUT, 'operations.ts'), body)
}

console.log(`\nEscrito em src/generated/:`)
console.log(`  enums.ts        ${enumGroups.length} enums`)
console.log(`  schemas/        ${grouped.size} arquivos, ${fileOfSchema.size} schemas`)
console.log(`  operations.ts   ${ops.length} operações`)
