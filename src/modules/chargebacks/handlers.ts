/**
 * Track H — chargeback (3 operações da tag "Chargeback").
 *
 * A criação não está aqui porque não existe na spec: ver o comentário do topo de
 * `service.ts`. A porta é `POST /_admin/payments/{id}/chargeback`.
 */
import { and, count, eq, gte, lte } from 'drizzle-orm'
import { badRequest, notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import type { DB } from '../../db/client.ts'
import { chargebacks, creditCards, payments } from '../../db/schema/index.ts'
import { cents, centsToBrl } from '../../domain/money.ts'
import type { HandlerMap } from '../../http/register.ts'
import type { ChargebackRow } from './service.ts'

/** O formato exato da resposta do Asaas. Centavos viram reais só aqui. */
export async function serializeChargeback(
  db: DB,
  row: ChargebackRow,
): Promise<Record<string, unknown>> {
  let card: { number: string | null; brand: string | null } | null = null

  const [payment] = await db
    .select({ creditCardId: payments.creditCardId })
    .from(payments)
    .where(eq(payments.id, row.paymentId))
    .limit(1)

  if (payment?.creditCardId) {
    const [c] = await db
      .select()
      .from(creditCards)
      .where(eq(creditCards.id, payment.creditCardId))
      .limit(1)
    // Os 4 últimos dígitos. O PAN nunca esteve aqui.
    if (c) card = { number: c.last4, brand: c.brand }
  }

  return {
    id: row.id,
    payment: row.paymentId,
    installment: row.installmentId,
    customerAccount: row.customerAccount,
    status: row.status,
    reason: row.reason,
    disputeStartDate: row.disputeStartDate,
    value: centsToBrl(cents(row.valueCents)),
    paymentDate: row.paymentDate,
    creditCard: card,
    disputeStatus: row.disputeStatus,
    deadlineToSendDisputeDocuments: row.deadlineToSendDisputeDocuments,
  }
}

export const chargebackHandlers: HandlerMap = {
  'list-chargebacks': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const filters = [eq(chargebacks.accountId, auth.accountId)]
    if (query.status) filters.push(eq(chargebacks.status, String(query.status)))
    if (query['originDisputeDate[ge]']) {
      filters.push(gte(chargebacks.disputeStartDate, String(query['originDisputeDate[ge]'])))
    }
    if (query['originDisputeDate[le]']) {
      filters.push(lte(chargebacks.disputeStartDate, String(query['originDisputeDate[le]'])))
    }
    if (query['originTransactionDate[ge]']) {
      filters.push(gte(chargebacks.paymentDate, String(query['originTransactionDate[ge]'])))
    }
    if (query['originTransactionDate[le]']) {
      filters.push(lte(chargebacks.paymentDate, String(query['originTransactionDate[le]'])))
    }

    const where = and(...filters)

    const [total] = await ctx.db.select({ n: count() }).from(chargebacks).where(where)
    const rows = await ctx.db
      .select()
      .from(chargebacks)
      .where(where)
      .limit(limit)
      .offset(offset)

    let data = await Promise.all(rows.map((r) => serializeChargeback(ctx.db, r as ChargebackRow)))

    // A bandeira mora no cartão, não no chargeback — o filtro é aplicado depois
    // de serializar. TODO(perf): se a base crescer, vira JOIN.
    if (query.creditCardBrand) {
      data = data.filter(
        (c) => (c.creditCard as { brand?: string } | null)?.brand === query.creditCardBrand,
      )
    }

    return listEnvelope(data, total?.n ?? 0, limit, offset)
  },

  /** `GET /v3/payments/{id}/chargeback` */
  'retrieve-a-single-chargeback': async ({ ctx, auth, params }) => {
    const [row] = await ctx.db
      .select()
      .from(chargebacks)
      .where(
        and(
          eq(chargebacks.paymentId, params.id!),
          eq(chargebacks.accountId, auth.accountId),
        ),
      )
      .limit(1)

    if (!row) throw notFound('Chargeback')
    return serializeChargeback(ctx.db, row as ChargebackRow)
  },

  /**
   * `POST /v3/chargebacks/{id}/dispute` — multipart, com os documentos.
   *
   * Os arquivos NÃO são guardados: a spec não devolve conteúdo nem link deles em
   * lugar nenhum, e persistir binário para nunca mais ler seria só peso. O que
   * muda de verdade é o status: REQUESTED → IN_DISPUTE.
   */
  'create-a-chargeback-dispute': async ({ ctx, auth, params, body }) => {
    const [row] = await ctx.db
      .select()
      .from(chargebacks)
      .where(and(eq(chargebacks.id, params.id!), eq(chargebacks.accountId, auth.accountId)))
      .limit(1)

    if (!row) throw notFound('Chargeback')
    if (row.status !== 'REQUESTED') {
      throw badRequest(
        'invalid_action',
        `Não é possível abrir disputa em um chargeback com status ${row.status}.`,
      )
    }

    const raw = (body ?? {}) as Record<string, unknown>
    const files = (Array.isArray(raw.files) ? raw.files : raw.files ? [raw.files] : []) as {
      name?: string
    }[]

    if (!files.length) {
      throw badRequest('invalid_files', 'Envie ao menos um documento para abrir a disputa.')
    }

    await ctx.db
      .update(chargebacks)
      .set({ status: 'IN_DISPUTE', disputeStatus: 'REQUESTED' })
      .where(eq(chargebacks.id, row.id))

    return {
      chargebackId: row.id,
      status: 'REQUESTED',
      files: files.map((f, i) => f?.name ?? `documento-${i + 1}`),
    }
  },
}
