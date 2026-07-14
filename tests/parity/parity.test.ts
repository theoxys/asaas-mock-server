/**
 * PARIDADE COM O ASAAS REAL.
 *
 * Replica contra o simulador exatamente os roteiros que `bun run capture` rodou
 * contra o sandbox de verdade, e compara campo a campo.
 *
 * Toda divergência que aparecer aqui é um BUG NOSSO. O Asaas é a verdade; nós é
 * que estamos imitando. Não "conserte" o golden — conserte o simulador, e leve a
 * regra provada para o golden test de unidade em tests/unit/.
 *
 * A suíte se AUTO-PULA quando não há golden capturado (ninguém roda isto sem uma
 * chave de sandbox). Não confunda "pulou" com "passou": enquanto não houver
 * golden, a fidelidade deste projeto é uma hipótese, não um fato.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GoldenFile } from '../../tools/capture.ts'
import { RELATIVE_DATE_FIELDS, VOLATILE_FIELDS } from '../golden/scenarios.ts'
import { createHarness, type Harness } from '../helpers/harness.ts'

const GOLDEN_DIR = join(import.meta.dir, '..', 'golden')

const goldenFiles = existsSync(GOLDEN_DIR)
  ? readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.json'))
  : []

const DAY_MS = 86_400_000

/**
 * Converte uma data absoluta na sua DISTÂNCIA até a âncora.
 *
 * O sandbox real roda no calendário de hoje; o simulador, num relógio virtual.
 * Comparar '2026-08-15' com '2026-01-05' não diria nada. Comparar 'D+32' com
 * 'D+32' prova a regra de crédito do cartão, independente de quando a captura
 * rodou.
 */
function relativize(value: string, anchor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value
  const a = Date.parse(`${anchor}T12:00:00Z`)
  const d = Date.parse(`${value.slice(0, 10)}T12:00:00Z`)
  const days = Math.round((d - a) / DAY_MS)
  return `D${days >= 0 ? '+' : ''}${days}`
}

/**
 * Prepara uma resposta para o diff.
 *
 * Datas viram offsets relativos. Campos voláteis (ids, URLs do domínio deles)
 * perdem o VALOR mas mantêm a CHAVE e a nulidade — porque "veio null" e "veio
 * preenchido" é informação de contrato, e "o campo existe" também.
 *
 * Tudo o mais é comparado literalmente. É aí que uma divergência de regra
 * aparece: `value`, `netValue`, `status`, `billingType`, a estrutura de
 * discount/fine/interest, o conjunto de chaves do objeto.
 */
function normalize(value: unknown, anchor: string): unknown {
  if (Array.isArray(value)) return value.map((v) => normalize(v, anchor))
  if (!value || typeof value !== 'object') return value

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (v === null || v === undefined) {
      out[k] = null
    } else if (RELATIVE_DATE_FIELDS.includes(k) && typeof v === 'string') {
      out[k] = relativize(v, anchor)
    } else if (VOLATILE_FIELDS.includes(k)) {
      out[k] = '<volátil>'
    } else {
      out[k] = normalize(v, anchor)
    }
  }
  return out
}

/** '$hoje+5' → data ISO, contada a partir da âncora do golden. */
function resolveDates(value: unknown, anchor: string): unknown {
  if (typeof value === 'string') {
    const m = value.match(/^\$hoje(?:\+(\d+))?$/)
    if (!m) return value
    const d = new Date(`${anchor}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + Number(m[1] ?? 0))
    return d.toISOString().slice(0, 10)
  }
  if (Array.isArray(value)) return value.map((v) => resolveDates(v, anchor))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveDates(v, anchor)]),
    )
  }
  return value
}

/** '$customerId' → o id que o SIMULADOR gerou no passo anterior. */
function resolveRefs(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === 'string') {
    return value.startsWith('$') && vars[value.slice(1)] !== undefined
      ? vars[value.slice(1)]!
      : value
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, vars))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveRefs(v, vars)]),
    )
  }
  return value
}

if (goldenFiles.length === 0) {
  describe('paridade com o Asaas real', () => {
    it.skip('SEM GOLDEN CAPTURADO — a fidelidade ainda é uma hipótese', () => {
      // Para capturar (exige uma chave de SANDBOX, que começa com $aact_hmlg_):
      //
      //   ASAAS_SANDBOX_API_KEY='$aact_hmlg_…' bun run capture
      //   bun test tests/parity
      //
      // Enquanto isto não rodar, toda regra de negócio deste simulador é a nossa
      // melhor leitura da documentação — e a documentação do Asaas se contradiz
      // em mais de um ponto (ver "divergências conhecidas" em progress.md).
    })
  })
} else {
  describe('paridade com o Asaas real', () => {
    for (const file of goldenFiles) {
      const golden = JSON.parse(readFileSync(join(GOLDEN_DIR, file), 'utf8')) as GoldenFile

      describe(golden.scenario, () => {
        it(golden.description, async () => {
          // O relógio do simulador é ancorado na data em que a captura rodou,
          // para que '$hoje+5' signifique a mesma coisa dos dois lados.
          const h: Harness = await createHarness({
            clock: {
              mode: 'VIRTUAL_FROZEN',
              start: `${golden.anchorDate}T09:00:00-03:00`,
              tickIntervalMs: 0,
            },
          })

          try {
            const vars: Record<string, string> = {}

            for (const captured of golden.steps) {
              const { step, response: expected } = captured

              const params = Object.fromEntries(
                Object.entries(step.params ?? {}).map(([k, v]) => [
                  k,
                  String(resolveRefs(v, vars)),
                ]),
              )
              const query = Object.fromEntries(
                Object.entries(step.query ?? {}).map(([k, v]) => [
                  k,
                  String(resolveRefs(v, vars)),
                ]),
              )
              const body =
                step.body === undefined
                  ? undefined
                  : resolveRefs(resolveDates(step.body, golden.anchorDate), vars)

              const actual = await h.api.call(step.operationId, {
                ...(Object.keys(params).length ? { params } : {}),
                ...(Object.keys(query).length ? { query } : {}),
                ...(body !== undefined ? { body } : {}),
              })

              // Guarda os ids que o SIMULADOR gerou, para os passos seguintes.
              for (const [name, field] of Object.entries(step.capture ?? {})) {
                const v = (actual.body as Record<string, unknown> | null)?.[field]
                if (v !== undefined && v !== null) vars[name] = String(v)
              }

              const where = `${golden.scenario} › ${step.label}`

              expect(actual.status, `Status HTTP divergente em "${where}"`).toBe(
                expected.status,
              )

              expect(
                normalize(actual.body, golden.anchorDate),
                `Resposta divergente em "${where}" — o Asaas é a verdade, ` +
                  `conserte o simulador`,
              ).toEqual(normalize(expected.body, golden.anchorDate) as never)
            }
          } finally {
            h.close()
          }
        })
      })
    }
  })
}
