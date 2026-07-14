/**
 * O ciclo de vida da antecipação, no tempo. (Track D)
 *
 * Três coisas, nesta ordem:
 *
 *   0. ANTECIPAÇÃO AUTOMÁTICA — se a conta ligou o flag, toda cobrança de cartão
 *      confirmada é antecipada sozinha.
 *   1. SCHEDULED → CREDITED — a antecipação de uma cobrança que ainda não tinha
 *      sido paga. Quando o pagador paga (CONFIRMED), o dinheiro entra.
 *   2. CREDITED → DEBITED — o recebível original liquidou (PAYMENT_RECEIVED
 *      acabou de creditar a conta), então o adiantamento sai. É o lançamento que
 *      fecha o ciclo e mantém `balance === SUM(ledger)`.
 *
 * RODA DEPOIS do `credit-settlement` — e isso é semântico, não incidental: o
 * débito da antecipação só faz sentido depois que o crédito do recebível entrou.
 * Inverter a ordem deixaria o saldo negativo por um tick.
 */
import { and, eq, inArray } from 'drizzle-orm'
import type { AppContext } from '../../core/context.ts'
import type { DB } from '../../db/client.ts'
import { anticipations, payments } from '../../db/schema/index.ts'
import type { AnticipationRow } from '../../modules/anticipations/serializer.ts'
import { serializeAnticipation } from '../../modules/anticipations/serializer.ts'
import {
  emitAnticipation,
  getAutoConfig,
  postCredit,
  postDebit,
  quoteFor,
  requestAnticipation,
} from '../../modules/anticipations/service.ts'
import type { PaymentRow } from '../../modules/payments/serializer.ts'
import type { Job, TickReport } from '../scheduler.ts'

export const anticipationSettlement: Job = {
  name: 'anticipation-settlement',

  async run({ ctx, report }) {
    await autoAnticipate(ctx, report)

    await ctx.db.transaction(async (tx) => {
      const db = tx as unknown as DB
      const open = await db
        .select()
        .from(anticipations)
        .where(inArray(anticipations.status, ['SCHEDULED', 'CREDITED']))

      for (const row of open as AnticipationRow[]) {
        if (!row.paymentId) continue

        const [payment] = await db
          .select()
          .from(payments)
          .where(eq(payments.id, row.paymentId))
          .limit(1)
        if (!payment) continue

        const status = (payment as PaymentRow).status

        if (row.status === 'SCHEDULED') {
          if (status === 'CONFIRMED') {
            await transition(ctx, db, report, row, 'CREDITED', async (after) => {
              await postCredit(ctx, db, after)
              report.ledgerEntries += 2
            })
          } else if (status === 'RECEIVED' || status === 'RECEIVED_IN_CASH') {
            /**
             * O recebível liquidou antes de a antecipação ser processada — o
             * dinheiro já caiu por PAYMENT_RECEIVED. Não há o que adiantar.
             * NEGAMOS, sem mover um centavo: creditar e debitar no mesmo tick
             * cobraria uma taxa de antecipação por um adiantamento de zero dia.
             */
            await transition(ctx, db, report, row, 'DENIED', async (after) => {
              await db
                .update(anticipations)
                .set({
                  denialObservation:
                    'O recebível foi liquidado antes de a antecipação ser processada.',
                })
                .where(eq(anticipations.id, after.id))
              await db
                .update(payments)
                .set({ anticipated: false })
                .where(eq(payments.id, after.paymentId!))
            })
          }
          continue
        }

        // CREDITED: espera o recebível liquidar de verdade.
        if (status === 'RECEIVED') {
          await transition(ctx, db, report, row, 'DEBITED', async (after) => {
            await postDebit(ctx, db, after)
            report.ledgerEntries += 1
          })
        }
      }
    })
  },
}

/** COMPARE-AND-SWAP + efeito + webhook. Um tick repetido altera zero linhas. */
async function transition(
  ctx: AppContext,
  db: DB,
  report: TickReport,
  row: AnticipationRow,
  to: 'CREDITED' | 'DEBITED' | 'DENIED',
  effect: (after: AnticipationRow) => Promise<void>,
): Promise<void> {
  const patch: Record<string, unknown> = { status: to }
  if (to === 'CREDITED') patch.anticipationDate = ctx.clock.today()

  const updated = await db
    .update(anticipations)
    .set(patch)
    .where(and(eq(anticipations.id, row.id), eq(anticipations.status, row.status)))
    .returning()

  if (!updated.length) return

  const after = updated[0] as AnticipationRow
  await effect(after)

  report.transitions.push({
    resource: 'anticipation',
    id: after.id,
    from: row.status,
    to,
    job: 'anticipation-settlement',
  })

  const [fresh] = await db
    .select()
    .from(anticipations)
    .where(eq(anticipations.id, after.id))
    .limit(1)

  await emitAnticipation(
    ctx,
    db,
    after.accountId,
    after.id,
    `RECEIVABLE_ANTICIPATION_${to}`,
    serializeAnticipation((fresh ?? after) as AnticipationRow),
  )
}

/**
 * Antecipação automática de cartão de crédito.
 *
 * O flag `creditCardAutomaticEnabled` (PUT /v3/anticipations/configurations)
 * existe na API do Asaas e liga exatamente isto. Um booleano persistido que não
 * antecipa nada produziria falsa confiança — que é a única coisa que este
 * projeto não pode fazer.
 */
async function autoAnticipate(ctx: AppContext, report: TickReport): Promise<void> {
  const candidates = await ctx.db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.status, 'CONFIRMED'),
        eq(payments.billingType, 'CREDIT_CARD'),
        eq(payments.anticipated, false),
        eq(payments.deleted, false),
      ),
    )

  if (!candidates.length) return

  const enabled = new Map<string, boolean>()

  for (const row of candidates as PaymentRow[]) {
    let on = enabled.get(row.accountId)
    if (on === undefined) {
      on = (await getAutoConfig(ctx.db, row.accountId)).creditCardAutomaticEnabled
      enabled.set(row.accountId, on)
    }
    if (!on) continue

    try {
      const created = await requestAnticipation(ctx, row.accountId, {
        payment: row,
        quote: quoteFor(ctx, row),
        creditsNow: true,
      })
      report.created.push({
        resource: 'anticipation',
        id: String(created.id),
        job: 'anticipation-settlement',
      })
      report.ledgerEntries += 2
    } catch (err) {
      // O CAS em `payments.anticipated` já protege contra duplicata; qualquer
      // outra recusa é informação, não erro do job.
      ctx.log('debug', `anticipation-settlement: ${row.id} não antecipou`, {
        error: String(err),
      })
    }
  }
}
