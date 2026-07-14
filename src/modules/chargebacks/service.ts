/**
 * Chargeback — a disputa que o portador do cartão abre no banco emissor.
 *
 * ATENÇÃO A UMA COISA QUE A SPEC NÃO RESOLVE: não existe operação para CRIAR um
 * chargeback. Faz sentido no mundo real (quem abre é a bandeira, não o lojista),
 * mas deixa o fluxo inteiro — inclusive `list-chargebacks` e o gatilho
 * CHARGEBACK da máquina de estados — sem nenhuma porta de entrada. Um simulador
 * em que o dev não consegue provocar um chargeback é um simulador que não serve
 * para testar chargeback.
 *
 * Por isso a porta é `POST /_admin/payments/{id}/chargeback` — o mesmo lugar de
 * onde se viaja no tempo. É controle do SIMULADOR, não da API do Asaas: fica
 * fora de /v3, exatamente como o relógio.
 */
import { and, eq } from 'drizzle-orm'
import type { AppContext } from '../../core/context.ts'
import { badRequest, notFound } from '../../core/errors.ts'
import type { DB } from '../../db/client.ts'
import { chargebacks, payments } from '../../db/schema/index.ts'
import { addDays } from '../../domain/calendar.ts'
import * as ids from '../../domain/ids.ts'
import { applyTransition } from '../payments/apply.ts'

export type ChargebackRow = typeof chargebacks.$inferSelect

/**
 * TODO(regra): a doc não publica o prazo para enviar os documentos da disputa.
 * 20 dias corridos a partir da abertura é o número que aparece nos exemplos da
 * spec (disputeStartDate 2024-11-10 → deadline 2024-12-10 são 30; o campo é
 * nullable). Deixamos 20 e registramos em progress.md — quando alguém provar o
 * valor real contra o Asaas, muda aqui.
 */
const DISPUTE_DEADLINE_DAYS = 20

/**
 * Abre um chargeback numa cobrança PAGA (CONFIRMED ou RECEIVED).
 *
 * O status vai a CHARGEBACK_REQUESTED via `applyTransition` — que também emite o
 * PAYMENT_CHARGEBACK_REQUESTED e DEBITA o valor do saldo, se ele já tinha sido
 * creditado. Nada disso é lembrado por este arquivo: são efeitos da transição.
 */
export async function openChargeback(
  ctx: AppContext,
  paymentId: string,
  reason: string,
): Promise<ChargebackRow> {
  const [payment] = await ctx.db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)

  if (!payment) throw notFound('Cobrança')

  const [existing] = await ctx.db
    .select()
    .from(chargebacks)
    .where(eq(chargebacks.paymentId, paymentId))
    .limit(1)

  if (existing) {
    throw badRequest('invalid_action', 'Esta cobrança já possui um chargeback.')
  }

  const today = ctx.clock.today()

  return ctx.db.transaction(async (t) => {
    const tx = t as unknown as DB

    await applyTransition(ctx, paymentId, { kind: 'CHARGEBACK' }, tx)

    const row: ChargebackRow = {
      id: ids.genericId(ctx.rng),
      accountId: payment.accountId,
      paymentId,
      installmentId: payment.installmentId,
      customerAccount: payment.customerId,
      status: 'REQUESTED',
      reason,
      disputeStatus: null,
      valueCents: payment.valueCents,
      paymentDate: payment.paymentDate,
      disputeStartDate: today,
      deadlineToSendDisputeDocuments: addDays(today, DISPUTE_DEADLINE_DAYS),
      dateCreated: ctx.clock.timestamp(),
    }

    await tx.insert(chargebacks).values(row)
    return row
  })
}

/** O chargeback desta cobrança, se houver. Escopo de conta obrigatório. */
export async function chargebackOfPayment(
  db: DB,
  accountId: string,
  paymentId: string,
): Promise<ChargebackRow | null> {
  const [row] = await db
    .select()
    .from(chargebacks)
    .where(and(eq(chargebacks.paymentId, paymentId), eq(chargebacks.accountId, accountId)))
    .limit(1)
  return row ?? null
}
