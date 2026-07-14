/**
 * CAPTURA DE PARIDADE — roda os roteiros contra o SANDBOX REAL do Asaas e grava
 * as respostas em tests/golden/.
 *
 *   ASAAS_SANDBOX_API_KEY='$aact_hmlg_…' bun run capture
 *   ASAAS_SANDBOX_API_KEY='…' bun run capture -- pix-recebido   # um roteiro só
 *
 * Depois: `bun test tests/parity` replica os mesmos roteiros contra o simulador
 * e faz diff campo a campo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É A PEÇA MAIS IMPORTANTE DO PROJETO
 *
 * Toda regra de negócio aqui foi LIDA na documentação, não PROVADA contra a API.
 * E a documentação do Asaas se contradiz: diz "só HTTP 200 é sucesso" numa página
 * e "família 2xx" em outra; o marketing diz que o cartão credita em 30 dias e a
 * doc técnica diz 32.
 *
 * Um mock sutilmente errado é PIOR que nenhum mock, porque produz falsa
 * confiança: o dev ajusta o código para agradar o simulador e quebra em produção.
 * Isto é o que fecha essa brecha.
 *
 * NOTA: esta captura cobre as RESPOSTAS HTTP. Os payloads de webhook exigiriam
 * um túnel público (o sandbox não entrega em localhost — que é, afinal, o motivo
 * de este projeto existir). Está registrado em progress.md como lacuna.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getOperation } from '../src/generated/operations.ts'
import { SCENARIOS, type Scenario, type Step } from '../tests/golden/scenarios.ts'

const BASE = 'https://api-sandbox.asaas.com'
const GOLDEN_DIR = join(import.meta.dir, '..', 'tests', 'golden')

const apiKey = process.env.ASAAS_SANDBOX_API_KEY
if (!apiKey) {
  console.error(`
Falta a chave do sandbox REAL do Asaas.

  ASAAS_SANDBOX_API_KEY='$aact_hmlg_…' bun run capture

Pegue em: https://sandbox.asaas.com → Configurações → Integrações → API.
A chave de sandbox começa com "$aact_hmlg_". NÃO use a de produção.
`)
  process.exit(1)
}

if (!apiKey.startsWith('$aact_hmlg_')) {
  console.error(
    `A chave não parece ser de sandbox (deveria começar com "$aact_hmlg_").\n` +
      `Recusando por segurança: uma chave de produção criaria cobranças de verdade.`,
  )
  process.exit(1)
}

/** '$hoje+5' → data ISO. O sandbox real usa o calendário de verdade. */
function resolveDates(value: unknown, today: Date): unknown {
  if (typeof value === 'string') {
    const m = value.match(/^\$hoje(?:\+(\d+))?$/)
    if (m) {
      const d = new Date(today)
      d.setDate(d.getDate() + Number(m[1] ?? 0))
      return d.toISOString().slice(0, 10)
    }
    return value
  }
  if (Array.isArray(value)) return value.map((v) => resolveDates(v, today))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveDates(v, today)]),
    )
  }
  return value
}

/** Substitui `$customerId` pelos valores capturados em passos anteriores. */
function resolveRefs(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === 'string' && value.startsWith('$') && vars[value.slice(1)]) {
    return vars[value.slice(1)]
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, vars))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, vars)]))
  }
  return value
}

export interface CapturedStep {
  /**
   * O passo ORIGINAL, com os `$refs` e `$hoje+N` ainda por resolver.
   *
   * É o que permite ao replay re-executar o roteiro contra o simulador usando os
   * ids que ELE gera — se guardássemos só o request já resolvido, o replay
   * mandaria o id de um cliente do Asaas real, que aqui não existe.
   */
  step: Step
  /** O que efetivamente foi para o Asaas — para auditar o golden depois. */
  request: { method: string; path: string; body?: unknown; query?: Record<string, string> }
  response: { status: number; body: unknown }
}

export interface GoldenFile {
  scenario: string
  description: string
  capturedAt: string
  /** A data em que a captura rodou — a âncora das datas relativas. */
  anchorDate: string
  source: 'asaas-sandbox'
  steps: CapturedStep[]
}

async function runScenario(scenario: Scenario, today: Date): Promise<GoldenFile> {
  const vars: Record<string, string> = {}
  const steps: CapturedStep[] = []

  console.log(`\n▶ ${scenario.name}`)
  console.log(`  ${scenario.description}`)

  for (const step of scenario.steps as Step[]) {
    const op = getOperation(step.operationId)

    let path: string = op.specPath
    for (const [k, v] of Object.entries(step.params ?? {})) {
      const resolved = String(resolveRefs(v, vars))
      path = path.replace(`{${k}}`, encodeURIComponent(resolved))
    }

    const url = new URL(BASE + path)
    const query: Record<string, string> = {}
    for (const [k, v] of Object.entries(step.query ?? {})) {
      const resolved = String(resolveRefs(v, vars))
      url.searchParams.set(k, resolved)
      query[k] = resolved
    }

    const body =
      step.body === undefined
        ? undefined
        : resolveRefs(resolveDates(step.body, today), vars)

    const res = await fetch(url, {
      method: op.method.toUpperCase(),
      headers: {
        access_token: apiKey!,
        'content-type': 'application/json',
        'user-agent': 'asaas-mock-server/parity-capture',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    const text = await res.text()
    const responseBody = text ? JSON.parse(text) : null

    steps.push({
      step,
      request: {
        method: op.method.toUpperCase(),
        path,
        body,
        query: Object.keys(query).length ? query : undefined,
      },
      response: { status: res.status, body: responseBody },
    })

    // Guarda valores para os passos seguintes.
    for (const [name, field] of Object.entries(step.capture ?? {})) {
      const v = (responseBody as any)?.[field]
      if (v !== undefined) vars[name] = String(v)
    }

    const mark = res.status < 400 ? '✓' : '✗'
    console.log(`  ${mark} [${res.status}] ${step.label}`)

    // O Asaas limita requisições; não vale a pena correr.
    await Bun.sleep(700)
  }

  return {
    scenario: scenario.name,
    description: scenario.description,
    capturedAt: new Date().toISOString(),
    anchorDate: today.toISOString().slice(0, 10),
    source: 'asaas-sandbox',
    steps,
  }
}

// ── main ─────────────────────────────────────────────────────

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const selected = only.length
  ? SCENARIOS.filter((s) => only.includes(s.name))
  : SCENARIOS

if (!selected.length) {
  console.error(`Nenhum roteiro casou com: ${only.join(', ')}`)
  console.error(`Disponíveis: ${SCENARIOS.map((s) => s.name).join(', ')}`)
  process.exit(1)
}

mkdirSync(GOLDEN_DIR, { recursive: true })
const today = new Date()

console.log(`Capturando contra o sandbox REAL do Asaas (${BASE})`)
console.log(`Chave: ${apiKey.slice(0, 18)}…`)

for (const scenario of selected) {
  try {
    const golden = await runScenario(scenario, today)
    const path = join(GOLDEN_DIR, `${scenario.name}.json`)
    await Bun.write(path, `${JSON.stringify(golden, null, 2)}\n`)
    console.log(`  → tests/golden/${scenario.name}.json`)
  } catch (err) {
    console.error(`  ✗ ${scenario.name} falhou: ${err}`)
  }
}

console.log(`
Pronto. Agora rode a paridade:

  bun test tests/parity

Toda divergência que aparecer é um BUG NOSSO — o Asaas é a verdade. Corrija o
simulador, adicione a linha ao golden test de unidade, e registre em progress.md.
`)
