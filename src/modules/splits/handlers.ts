/**
 * Consulta de splits. (Track F)
 *
 * Duas visões do MESMO registro, e a diferença é o ponto:
 *
 *   /v3/payments/splits/paid      → o que SAIU desta conta (sou a origem)
 *   /v3/payments/splits/received  → o que ENTROU nesta conta (sou o destino)
 *
 * A mesma linha de `payment_splits` aparece nas duas listas — na conta de origem
 * como "pago" e na de destino como "recebido". É por isso que a subconta com API
 * key própria não é um detalhe de conveniência: sem ela, `received` seria sempre
 * vazio e metade do recurso não teria como ser testada.
 */
import { and, count, eq, gte, lte, type SQL } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import { payments, paymentSplits } from '../../db/schema/index.ts'
import { cents, centsToBrl } from '../../domain/money.ts'
import type { HandlerMap } from '../../http/register.ts'

type SplitRow = typeof paymentSplits.$inferSelect
type PaymentRow = typeof payments.$inferSelect

const money = (v: number | null): number | null => (v === null ? null : centsToBrl(cents(v)))

/**
 * A fronteira: centavos viram reais, e o percentual sai da escala 1e4.
 * 923444 → 92.3444 (quatro casas decimais, como o Asaas).
 */
function serializeSplit(s: SplitRow, p: PaymentRow): Record<string, unknown> {
  return {
    id: s.id,
    walletId: s.walletId,
    fixedValue: money(s.fixedValueCents),
    percentualValue: s.percentualValueE4 === null ? null : s.percentualValueE4 / 10_000,
    totalValue: money(s.totalValueCents),
    cancellationReason: s.cancellationReason,
    status: s.status,
    externalReference: s.externalReference,
    description: s.description,

    // Quem pagou e quem recebeu. `destinationAccountId` é null quando o walletId
    // é de uma carteira externa — nesse caso não há conta neste servidor.
    originAccountId: p.accountId,
    destinationAccountId: s.recipientAccountId,

    creditDate: s.creditDate,
    payment: {
      confirmedDate: p.confirmedDate,
      invoiceNumber: p.invoiceNumber,
      externalReference: p.externalReference,
    },
  }
}

/** Os filtros que a spec declara nas duas listagens. */
function splitFilters(query: Record<string, unknown>): SQL[] {
  const filters: SQL[] = []

  if (query.paymentId) filters.push(eq(paymentSplits.paymentId, String(query.paymentId)))
  if (query.status) filters.push(eq(paymentSplits.status, String(query.status)))

  if (query['creditDate[ge]']) {
    filters.push(gte(paymentSplits.creditDate, String(query['creditDate[ge]'])))
  }
  if (query['creditDate[le]']) {
    filters.push(lte(paymentSplits.creditDate, String(query['creditDate[le]'])))
  }
  if (query['paymentConfirmedDate[ge]']) {
    filters.push(gte(payments.confirmedDate, String(query['paymentConfirmedDate[ge]'])))
  }
  if (query['paymentConfirmedDate[le]']) {
    filters.push(lte(payments.confirmedDate, String(query['paymentConfirmedDate[le]'])))
  }

  return filters
}

async function listSplits(
  ctx: AppContext,
  query: Record<string, unknown>,
  scope: SQL,
): Promise<unknown> {
  const { limit, offset } = paginationParams(query)
  const where = and(scope, ...splitFilters(query))

  const [total] = await ctx.db
    .select({ n: count() })
    .from(paymentSplits)
    .innerJoin(payments, eq(paymentSplits.paymentId, payments.id))
    .where(where)

  const rows = await ctx.db
    .select({ split: paymentSplits, payment: payments })
    .from(paymentSplits)
    .innerJoin(payments, eq(paymentSplits.paymentId, payments.id))
    .where(where)
    .limit(limit)
    .offset(offset)

  const data = rows.map((r) => serializeSplit(r.split, r.payment))
  return listEnvelope(data, total?.n ?? 0, limit, offset)
}

async function findSplit(ctx: AppContext, id: string, scope: SQL): Promise<unknown> {
  const [row] = await ctx.db
    .select({ split: paymentSplits, payment: payments })
    .from(paymentSplits)
    .innerJoin(payments, eq(paymentSplits.paymentId, payments.id))
    .where(and(eq(paymentSplits.id, id), scope))
    .limit(1)

  // 404, não 403: um split de outra conta simplesmente NÃO EXISTE para você — a
  // API não confirma nem desmente. É o que o Asaas faz.
  if (!row) throw notFound('Split')
  return serializeSplit(row.split, row.payment)
}

/** Sou a ORIGEM: o split saiu de uma cobrança minha. */
const paidScope = (auth: AuthContext): SQL => eq(payments.accountId, auth.accountId)

/** Sou o DESTINO: a carteira do split é a da minha conta. */
const receivedScope = (auth: AuthContext): SQL =>
  eq(paymentSplits.recipientAccountId, auth.accountId)

export const splitHandlers: HandlerMap = {
  'list-paid-splits': ({ ctx, auth, query }) => listSplits(ctx, query, paidScope(auth)),

  'retrieve-a-single-paid-split': ({ ctx, auth, params }) =>
    findSplit(ctx, params.id!, paidScope(auth)),

  'list-received-splits': ({ ctx, auth, query }) => listSplits(ctx, query, receivedScope(auth)),

  'retrieve-a-single-received-split': ({ ctx, auth, params }) =>
    findSplit(ctx, params.id!, receivedScope(auth)),
}
