/**
 * A lista de jobs, NA ORDEM em que rodam. A ordem é semântica — leia o comentário
 * de cada um antes de mexer.
 *
 * Na Fase 0 os jobs existem mas não fazem nada: cada track preenche o seu. O que
 * já está de pé é a espinha (mutex, idempotência por dia simulado, TickReport),
 * que é o que os tracks precisam para não colidir.
 */
import type { Job } from '../scheduler.ts'
import { anticipationSettlement } from './anticipation-jobs.ts'
import { creditSettlement, overdue } from './payment-jobs.ts'
import { retentionPurge } from './retention-purge.ts'
import { splitDivergenceExpiry, splitRelease } from './split-jobs.ts'
import { subscriptionGeneration } from './subscription-jobs.ts'
import { transferSettlement } from './transfer-jobs.ts'
import { webhookDispatch } from './webhook-dispatch.ts'

/**
 * 1. Gera as cobranças das assinaturas cujo nextDueDate entrou na janela de
 *    lookahead (padrão: 40 dias). Roda PRIMEIRO para que uma cobrança gerada
 *    hoje já possa ser avaliada pelos jobs seguintes.
 *    → Track E — src/scheduler/jobs/subscription-jobs.ts
 */
export { subscriptionGeneration }

/**
 * 2. PENDING com dueDate < hoje → OVERDUE. A partir daqui juros e multa correm.
 *    → Track A — src/scheduler/jobs/payment-jobs.ts
 */
export { overdue }

/**
 * 3. CONFIRMED com creditDate <= hoje → RECEIVED. É aqui que o dinheiro vira
 *    saldo: lança PAYMENT_RECEIVED (+bruto) e PAYMENT_FEE (−taxa) no ledger.
 *    Pix pula esta etapa (vai direto a RECEIVED); cartão chega aqui em D+32.
 *    → Track A — src/scheduler/jobs/payment-jobs.ts
 */
export { creditSettlement }

/**
 * 4. Splits AWAITING_CREDIT de cobranças já creditadas → DONE. Move o dinheiro
 *    entre contas e lança nos DOIS extratos. Roda depois do crédito porque só
 *    existe split do que já entrou.
 *    → Track F — src/scheduler/jobs/split-jobs.ts
 */
export { splitRelease }

/**
 * 5. Splits BLOCKED_BY_VALUE_DIVERGENCE cujo prazo de ajuste (2 dias úteis)
 *    expirou → CANCELLED com cancellationReason VALUE_DIVERGENCE_BLOCK.
 *    → Track F — src/scheduler/jobs/split-jobs.ts
 */
export { splitDivergenceExpiry }

/**
 * 6. Antecipações SCHEDULED cuja data chegou → CREDITED; e o débito na
 *    liquidação do recebível original. Roda DEPOIS do crédito: o débito da
 *    antecipação só faz sentido depois que o recebível original entrou.
 *    → Track D — src/scheduler/jobs/anticipation-jobs.ts
 */
export { anticipationSettlement }

/**
 * 7. Transferências PENDING → BANK_PROCESSING → DONE/FAILED, no dia útil.
 *    → Track D — src/scheduler/jobs/transfer-jobs.ts
 */
export { transferSettlement }

/**
 * 8. Entrega os webhooks pendentes.
 *
 *    RODA POR ÚLTIMO, e isso é deliberado: assim todos os eventos gerados pelos
 *    jobs acima já estão na fila e saem juntos, na ordem em que aconteceram.
 *    Se o dispatcher rodasse no meio, um advance() de 40 dias entregaria eventos
 *    do dia 1 antes de o dia 1 terminar de ser processado.
 *    → Track B — src/scheduler/jobs/webhook-dispatch.ts
 */
export { webhookDispatch }

/**
 * 9. Expira entregas de webhook além da retenção (14 dias simulados).
 *    → Track B — src/scheduler/jobs/retention-purge.ts
 */
export { retentionPurge }

/** A ordem desta lista É a ordem de execução. */
export const JOBS: Job[] = [
  subscriptionGeneration,
  overdue,
  creditSettlement,
  splitRelease,
  splitDivergenceExpiry,
  anticipationSettlement,
  transferSettlement,
  webhookDispatch,
  retentionPurge,
]
