/**
 * A tabela de retentativa do Asaas. São 15 tentativas, e os intervalos NÃO são
 * uma progressão bonitinha — é uma tabela, decorada da documentação:
 *
 *   1ª   imediata          9ª   +1h
 *   2ª   +30s             10ª   +1h
 *   3ª   +1min            11ª   +1h
 *   4ª   +3min30s         12ª   +1h
 *   5ª   +5min            13ª   +2h
 *   6ª   +15min           14ª   +2h
 *   7ª   +25min           15ª   +3h
 *   8ª   +1h
 *
 * Esgotadas as 15, a entrega vira INTERRUPTED e a FILA INTEIRA daquele webhook
 * congela (`webhooks.interrupted = true`) até alguém chamar removeBackoff. É o
 * comportamento real, e é o que o dev precisa poder reproduzir localmente.
 *
 * O índice da tabela é o número de tentativas JÁ FEITAS: com 0 tentativas feitas
 * o offset é 0 (a primeira sai na hora); com 1 feita, espera-se 30s pela segunda.
 */
import { HOUR_MS, MINUTE_MS } from '../core/clock.ts'

/** Offsets em ms, medidos a partir da tentativa que acabou de falhar. */
export const BACKOFF_MS: readonly number[] = [
  0, //                     1ª tentativa: imediata
  30_000, //                2ª:  +30s
  MINUTE_MS, //             3ª:  +1min
  3 * MINUTE_MS + 30_000, // 4ª: +3min30s
  5 * MINUTE_MS, //         5ª:  +5min
  15 * MINUTE_MS, //        6ª:  +15min
  25 * MINUTE_MS, //        7ª:  +25min
  HOUR_MS, //               8ª:  +1h
  HOUR_MS, //               9ª:  +1h
  HOUR_MS, //              10ª:  +1h
  HOUR_MS, //              11ª:  +1h
  HOUR_MS, //              12ª:  +1h
  2 * HOUR_MS, //          13ª:  +2h
  2 * HOUR_MS, //          14ª:  +2h
  3 * HOUR_MS, //          15ª:  +3h
]

export const MAX_ATTEMPTS = BACKOFF_MS.length // 15

/**
 * Quando a próxima tentativa deve sair, dado o número de tentativas já feitas.
 *
 * `null` = acabou. A entrega vira INTERRUPTED e o webhook trava.
 *
 * `maxAttempts` vem de `config.webhook.maxAttempts` (default 15) — está atrás de
 * variável de ambiente porque é regra pesquisada na doc, não provada contra a
 * API real. Se for maior que a tabela, o último offset (3h) se repete.
 */
export function nextAttemptAt(
  attempt: number,
  nowMs: number,
  maxAttempts: number = MAX_ATTEMPTS,
): number | null {
  if (attempt >= maxAttempts) return null
  const offset = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!
  return nowMs + offset
}
