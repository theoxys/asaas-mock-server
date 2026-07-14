/**
 * `applyTransition` — o ÚNICO lugar onde o status de uma cobrança muda.
 *
 * Sandbox action, scheduler, captura, receiveInCash, refund: todos passam por
 * aqui. Como o webhook e o lançamento no ledger são EFEITOS da transição (e não
 * algo que cada handler lembra de fazer), é impossível que um caminho esqueça de
 * emitir o PAYMENT_RECEIVED ou de debitar a taxa. Essa classe inteira de bug não
 * existe neste desenho.
 *
 * Se você está escrevendo `UPDATE payments SET status = …` em outro arquivo,
 * pare: é exatamente o que esta regra existe para prevenir.
 */
import { and, eq } from 'drizzle-orm'
import type { AppContext } from '../../core/context.ts'
import { badRequest, notFound } from '../../core/errors.ts'
import { postEntries, type FinancialTransactionType } from '../../core/ledger.ts'
import type { DB } from '../../db/client.ts'
import { payments, paymentSplits } from '../../db/schema/index.ts'
import {
  plan,
  TransitionError,
  type PaymentState,
  type PaymentStatus,
  type Trigger,
} from '../../domain/payment-machine.ts'
import { cents } from '../../domain/money.ts'
import { serializePayment, type PaymentRow } from './serializer.ts'

/** Converte a linha do banco no estado que a máquina pura entende. */
function toState(
  row: PaymentRow,
  installmentCount: number,
  installmentTotalCents: number | null,
): PaymentState {
  return {
    id: row.id,
    status: row.status as PaymentStatus,
    billingType: row.billingType as PaymentState['billingType'],
    valueCents: cents(row.valueCents),
    originalValueCents: row.originalValueCents === null ? null : cents(row.originalValueCents),
    netValueCents: cents(row.netValueCents),
    feeCents: cents(row.feeCents),
    dueDate: row.dueDate,
    confirmedDate: row.confirmedDate,
    creditDate: row.creditDate,
    discount: row.discount,
    fine: row.fine,
    interest: row.interest,
    installmentCount,
    installmentTotalCents: installmentTotalCents === null ? null : cents(installmentTotalCents),
    // A coluna guarda TEXT (é o que o Asaas devolve). Aqui vira número: é
    // multiplicador de dias no D+32×n, e um "2" em string daria concatenação.
    installmentNumber: Number(row.installmentNumber ?? 1) || 1,
    deleted: row.deleted,
  }
}

export interface TransitionResult {
  payment: PaymentRow
  from: PaymentStatus
  to: PaymentStatus
  events: string[]
}

/**
 * Aplica um gatilho a uma cobrança, numa transação.
 *
 * `tx` é opcional: quando o chamador já está numa transação (o scheduler, por
 * exemplo), passa a dele; senão abrimos uma.
 */
export async function applyTransition(
  ctx: AppContext,
  paymentId: string,
  trigger: Trigger,
  tx?: DB,
): Promise<TransitionResult> {
  const run = async (db: DB): Promise<TransitionResult> => {
    const [row] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1)
    if (!row) throw notFound('Cobrança')

    /**
     * O parcelamento de onde esta cobrança veio. Precisamos de DUAS coisas dele:
     *   - installmentCount → escolhe a FAIXA percentual da taxa do cartão
     *   - totalValueCents  → é a BASE da taxa (o Asaas cobra sobre o total e
     *                        divide entre as parcelas; não sobre a parcela)
     */
    let installmentCount = 1
    let installmentTotalCents: number | null = null
    if (row.installmentId) {
      const { installments } = await import('../../db/schema/index.ts')
      const [inst] = await db
        .select({
          count: installments.installmentCount,
          total: installments.totalValueCents,
        })
        .from(installments)
        .where(eq(installments.id, row.installmentId))
        .limit(1)
      installmentCount = inst?.count ?? 1
      installmentTotalCents = inst?.total ?? null
    }

    const state = toState(row as PaymentRow, installmentCount, installmentTotalCents)

    let planned
    try {
      planned = plan(state, trigger, { fees: ctx.config.fees, rules: ctx.config.rules })
    } catch (err) {
      if (err instanceof TransitionError) throw badRequest(err.code, err.description)
      throw err
    }

    const patch: Record<string, unknown> = { status: planned.to }
    for (const [k, v] of Object.entries(planned.patch)) patch[k] = v

    /**
     * O comprovante nasce quando o dinheiro entra — o Asaas real devolve uma URL
     * de comprovante em toda cobrança paga, e `null` enquanto ela está PENDING.
     * Devolvíamos `null` sempre.
     *
     * Fica aqui, e não no handler, porque é consequência da TRANSIÇÃO: qualquer
     * caminho que pague a cobrança (sandbox action, cartão, scheduler, dinheiro)
     * passa por `applyTransition` — e nenhum precisa lembrar disto.
     */
    const PAGO = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']
    if (PAGO.includes(planned.to) && !row.transactionReceiptUrl) {
      patch.transactionReceiptUrl = `${ctx.config.publicBaseUrl}/comprovantes/${paymentId.replace('pay_', '')}`
    }

    /**
     * COMPARE-AND-SWAP: só atualiza se o status ainda é o que a máquina viu.
     * Uma execução duplicada de job altera zero linhas e é detectada aqui.
     */
    const updated = await db
      .update(payments)
      .set(patch)
      .where(and(eq(payments.id, paymentId), eq(payments.status, row.status)))
      .returning()

    if (!updated.length) {
      throw badRequest(
        'conflict',
        'A cobrança mudou de status durante a operação. Tente novamente.',
      )
    }

    const after = updated[0] as PaymentRow
    const events: string[] = []

    for (const effect of planned.effects) {
      switch (effect.t) {
        case 'LEDGER': {
          await postEntries(
            db,
            { clock: ctx.clock, rng: ctx.rng },
            effect.entries.map((e) => ({
              accountId: row.accountId,
              type: e.type as FinancialTransactionType,
              valueCents: e.valueCents,
              description: e.description,
              paymentId,
            })),
          )
          break
        }

        case 'WEBHOOK': {
          events.push(effect.event)
          await ctx.emit(db, {
            accountId: row.accountId,
            event: effect.event,
            resourceType: 'payment',
            resourceId: paymentId,
            // Congelado AGORA: uma retentativa daqui a 3h reenvia este payload,
            // não o estado futuro do recurso.
            resource: await serializePayment(db, after),
          })
          break
        }

        case 'SPLIT': {
          const splits = await db
            .select()
            .from(paymentSplits)
            .where(eq(paymentSplits.paymentId, paymentId))

          /**
           * Quem se move, e quem NÃO se move:
           *
           * - AWAITING_CREDIT só vem de PENDING. Um split BLOQUEADO por
           *   divergência de valor NÃO vira crédito só porque a cobrança foi
           *   paga — ele tem um relógio próprio de 2 dias úteis, e sobrescrevê-lo
           *   aqui apagaria o bloqueio em silêncio.
           * - CANCELLED e REFUNDED são terminais: não se cancela duas vezes.
           */
          const targets = splits.filter((s) =>
            effect.to === 'AWAITING_CREDIT'
              ? s.status === 'PENDING'
              : s.status !== 'CANCELLED' && s.status !== 'REFUNDED',
          )

          for (const s of targets) {
            // CAS, como em todo o resto.
            await db
              .update(paymentSplits)
              .set({
                status: effect.to,
                ...(effect.reason ? { cancellationReason: effect.reason } : {}),
                ...(effect.to === 'DONE' ? { creditDate: ctx.clock.today() } : {}),
              })
              .where(and(eq(paymentSplits.id, s.id), eq(paymentSplits.status, s.status)))
          }

          /**
           * ESTORNO: o split que JÁ CREDITOU tem que ser desfeito, senão o
           * dinheiro fica na conta de destino e a cobrança some — o destinatário
           * lucraria com o estorno. Reverte nos dois extratos, na mesma transação.
           */
          if (effect.to === 'REFUNDED') {
            const reversals = targets.filter(
              (s) => s.status === 'DONE' && s.recipientAccountId !== null,
            )
            for (const s of reversals) {
              const total = cents(s.totalValueCents ?? 0)
              if (total <= 0) continue

              await postEntries(db, { clock: ctx.clock, rng: ctx.rng }, [
                {
                  accountId: s.recipientAccountId!,
                  type: 'INTERNAL_TRANSFER_REVERSAL',
                  valueCents: cents(-total),
                  description: `Estorno de split da cobrança ${paymentId}`,
                  paymentId,
                  splitId: s.id,
                },
                {
                  accountId: row.accountId,
                  type: 'INTERNAL_TRANSFER_REVERSAL',
                  valueCents: total,
                  description: `Estorno de split da cobrança ${paymentId}`,
                  paymentId,
                  splitId: s.id,
                },
              ])
            }
          }

          // O split cancelado é um evento que o integrador precisa ver: alguém
          // que esperava receber, não vai mais.
          if (effect.to === 'CANCELLED' && targets.length) {
            events.push('PAYMENT_SPLIT_CANCELLED')
            await ctx.emit(db, {
              accountId: row.accountId,
              event: 'PAYMENT_SPLIT_CANCELLED',
              resourceType: 'payment',
              resourceId: paymentId,
              resource: await serializePayment(db, after),
            })
          }
          break
        }
      }
    }

    return {
      payment: after,
      from: row.status as PaymentStatus,
      to: planned.to,
      events,
    }
  }

  return tx ? run(tx) : ctx.db.transaction(async (t) => run(t as unknown as DB))
}
