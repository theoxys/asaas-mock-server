/**
 * Utilitários compartilhados de manipulação da spec OpenAPI do Asaas.
 *
 * `spec/openapi.json` é vendorizado byte-a-byte do upstream e NUNCA é editado à
 * mão — é isso que mantém o diff de drift limpo. Correções à spec vivem em
 * `spec/overlays/*.json` como JSON Patch e são aplicadas em memória no codegen.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SPEC_URL =
  'https://www.asaas.com/openApi/document?version=3&languageCode=en-US'

export const SPEC_DIR = join(import.meta.dir, '..', 'spec')
export const SPEC_PATH = join(SPEC_DIR, 'openapi.json')
export const LOCK_PATH = join(SPEC_DIR, 'openapi.lock.json')
export const OVERLAY_DIR = join(SPEC_DIR, 'overlays')

export interface OpenApiSpec {
  openapi: string
  info: { title: string; version: string }
  servers: { url: string; description?: string }[]
  paths: Record<string, Record<string, RawOperation>>
  components: { schemas: Record<string, any>; securitySchemes: Record<string, any> }
}

export interface RawOperation {
  operationId: string
  tags?: string[]
  summary?: string
  parameters?: any[]
  requestBody?: any
  responses: Record<string, any>
}

export interface SpecLock {
  sha256: string
  fetchedAt: string
  url: string
  openapi: string
  pathCount: number
  operationCount: number
  schemaCount: number
  /** operationId -> hash da forma da operação. É o que detecta mudança de campo. */
  operations: Record<string, string>
  /** nome do schema -> hash. */
  schemas: Record<string, string>
}

export const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export async function sha256(text: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(text)
  return hasher.digest('hex')
}

/** Hash estável: chaves ordenadas recursivamente, para que reordenação não vire drift. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as object).sort()
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`)
    .join(',')
  return `{${body}}`
}

export async function readSpec(): Promise<OpenApiSpec> {
  return JSON.parse(await Bun.file(SPEC_PATH).text()) as OpenApiSpec
}

export async function readLock(): Promise<SpecLock | null> {
  const f = Bun.file(LOCK_PATH)
  if (!(await f.exists())) return null
  return JSON.parse(await f.text()) as SpecLock
}

export function eachOperation(
  spec: OpenApiSpec,
): { path: string; method: HttpMethod; op: RawOperation }[] {
  const out: { path: string; method: HttpMethod; op: RawOperation }[] = []
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const op = item[method]
      if (op) out.push({ path, method, op })
    }
  }
  return out
}

export async function buildLock(raw: string, fetchedAt: string): Promise<SpecLock> {
  const spec = JSON.parse(raw) as OpenApiSpec
  const operations: Record<string, string> = {}
  for (const { path, method, op } of eachOperation(spec)) {
    operations[op.operationId] = (
      await sha256(stableStringify({ path, method, op }))
    ).slice(0, 16)
  }
  const schemas: Record<string, string> = {}
  for (const [name, schema] of Object.entries(spec.components.schemas)) {
    schemas[name] = (await sha256(stableStringify(schema))).slice(0, 16)
  }
  return {
    sha256: await sha256(raw),
    fetchedAt,
    url: SPEC_URL,
    openapi: spec.openapi,
    pathCount: Object.keys(spec.paths).length,
    operationCount: Object.keys(operations).length,
    schemaCount: Object.keys(schemas).length,
    operations,
    schemas,
  }
}

/**
 * O endpoint da spec responde 429 com facilidade. Nunca chame isto durante o
 * build — o build lê apenas o arquivo vendorizado.
 */
export async function fetchSpec(attempts = 4): Promise<string> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await Bun.sleep(2000 * 2 ** (i - 1))
    try {
      const res = await fetch(SPEC_URL, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      })
      if (res.status === 429) {
        lastError = new Error('429 Too Many Requests')
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      JSON.parse(text) // valida que é JSON antes de gravar
      return text
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(`Falha ao baixar a spec após ${attempts} tentativas: ${lastError}`)
}

interface Overlay {
  _why: string
  _source?: string
  patch: { op: 'add' | 'replace' | 'remove'; path: string; value?: unknown }[]
}

/** Aplica os overlays de `spec/overlays/` em memória. A spec em disco não muda. */
export function applyOverlays(spec: OpenApiSpec): { spec: OpenApiSpec; applied: string[] } {
  const files = readdirSync(OVERLAY_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
  const out = JSON.parse(JSON.stringify(spec)) as OpenApiSpec
  const applied: string[] = []

  for (const file of files) {
    const overlay: Overlay = JSON.parse(readFileSync(join(OVERLAY_DIR, file), 'utf8'))
    for (const patch of overlay.patch) applyPatch(out, patch, file)
    applied.push(file)
  }
  return { spec: out, applied }
}

function applyPatch(
  doc: unknown,
  patch: { op: string; path: string; value?: unknown },
  file: string,
): void {
  const tokens = patch.path
    .split('/')
    .slice(1)
    .map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'))
  const last = tokens.pop()
  if (last === undefined) throw new Error(`${file}: path inválido "${patch.path}"`)

  let cursor: any = doc
  for (const token of tokens) {
    cursor = cursor?.[token]
    if (cursor === undefined) {
      throw new Error(
        `${file}: path "${patch.path}" não resolve — o alvo sumiu da spec. ` +
          `Isso quase sempre significa que o Asaas mudou a API e o overlay ficou obsoleto.`,
      )
    }
  }

  if (patch.op === 'add' && Array.isArray(cursor) && last === '-') {
    cursor.push(patch.value)
  } else if (patch.op === 'add' || patch.op === 'replace') {
    cursor[last] = patch.value
  } else if (patch.op === 'remove') {
    delete cursor[last]
  } else {
    throw new Error(`${file}: op "${patch.op}" não suportada`)
  }
}
