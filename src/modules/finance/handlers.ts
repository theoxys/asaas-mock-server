/**
 * Finance — saldo, extrato e estatísticas. (Track D)
 *
 * Nada aqui ESCREVE. Este módulo é a janela para o que o ledger já registrou:
 * `accounts.balanceCents` é saldo materializado, escrito só por `postEntries()`,
 * e `financial_transactions` é append-only. Se um número parecer errado, o bug
 * está em quem lançou — não aqui.
 */
import { and, asc, count, desc, eq, gte, inArray, lte, sum } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { invalid, notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import {
  accounts,
  financialTransactions,
  payments,
  paymentSplits,
} from '../../db/schema/index.ts'
import { isValidIsoDate } from '../../domain/calendar.ts'
import { cents, centsToBrl } from '../../domain/money.ts'
import type { HandlerMap } from '../../http/register.ts'

type FinancialTransactionRow = typeof financialTransactions.$inferSelect

const money = (v: number | null): number | null => (v === null ? null : centsToBrl(cents(v)))

/** Splits que ainda vão se mover. Um split DONE já virou lançamento no extrato. */
const OPEN_SPLIT_STATUSES = ['PENDING', 'PROCESSING', 'AWAITING_CREDIT'] as const

async function balanceOf(ctx: AppContext, accountId: string): Promise<number> {
  const [row] = await ctx.db
    .select({ balanceCents: accounts.balanceCents })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)
  if (!row) throw notFound('Conta')
  return row.balanceCents
}

/**
 * Uma linha do extrato, no formato exato do Asaas.
 *
 * `balance` é o saldo DEPOIS deste lançamento — não o saldo atual da conta. É o
 * que permite auditar o extrato linha a linha, e é a razão de `balanceCents` ser
 * gravado junto com o lançamento em vez de recalculado na leitura.
 */
function serializeTransaction(t: FinancialTransactionRow): Record<string, unknown> {
  return {
    object: 'financialTransaction',
    id: t.id,
    value: money(t.valueCents),
    balance: money(t.balanceCents),
    type: t.type,
    date: t.date,
    description: t.description,
    paymentId: t.paymentId,
    splitId: t.splitId,
    transferId: t.transferId,
    anticipationId: t.anticipationId,
    billId: t.billId,
    invoiceId: t.invoiceId,
    paymentDunningId: t.paymentDunningId,
    creditBureauReportId: t.creditBureauReportId,
  }
}

function isoDateParam(query: Record<string, unknown>, key: string): string | undefined {
  const raw = query[key]
  if (raw === undefined || raw === '') return undefined
  const s = String(raw)
  if (!isValidIsoDate(s)) throw invalid(key, `A data informada em "${key}" é inválida.`)
  return s
}

export const financeHandlers: HandlerMap = {
  /**
   * GET /v3/finance/balance → { "balance": 5210.96 }
   *
   * SÓ o campo `balance`. É o endpoint mais simples da API e o mais fácil de
   * enfeitar por engano — um campo a mais aqui e o cliente que faz
   * `Object.keys(res).length === 1` quebra.
   */
  'retrieve-account-balance': async ({ ctx, auth }) => ({
    balance: centsToBrl(cents(await balanceOf(ctx, auth.accountId))),
  }),

  /**
   * GET /v3/financialTransactions — o extrato.
   *
   * Ordenado por `seq` (ordem de inserção), não por `date`: dois lançamentos do
   * mesmo dia — PAYMENT_RECEIVED e PAYMENT_FEE — têm a mesma data, e ordenar por
   * data deixaria a coluna `balance` fora de ordem, que é exatamente o que o
   * extrato existe para mostrar.
   *
   * TODO(regra): a doc não define a ordem DEFAULT nem os valores aceitos em
   * `order`. Usamos `asc` (cronológico) por default, que é a única ordem em que
   * a coluna `balance` faz sentido de cima para baixo.
   */
  'retrieve-extract': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const startDate = isoDateParam(query, 'startDate')
    const finishDate = isoDateParam(query, 'finishDate')

    const order = String(query.order ?? 'asc').toLowerCase()
    if (order !== 'asc' && order !== 'desc') {
      throw invalid('order', 'A ordenação deve ser "asc" ou "desc".')
    }

    const filters = [eq(financialTransactions.accountId, auth.accountId)]
    if (startDate) filters.push(gte(financialTransactions.date, startDate))
    if (finishDate) filters.push(lte(financialTransactions.date, finishDate))

    const where = and(...filters)

    const [total] = await ctx.db
      .select({ n: count() })
      .from(financialTransactions)
      .where(where)

    const rows = await ctx.db
      .select()
      .from(financialTransactions)
      .where(where)
      .orderBy(
        order === 'desc' ? desc(financialTransactions.seq) : asc(financialTransactions.seq),
      )
      .limit(limit)
      .offset(offset)

    return listEnvelope(rows.map(serializeTransaction), total?.n ?? 0, limit, offset)
  },

  /**
   * GET /v3/finance/payment/statistics — quantidade e soma das cobranças que
   * batem com o filtro. Os mesmos filtros de GET /v3/payments.
   */
  'billing-statistics': async ({ ctx, auth, query }) => {
    const filters = [
      eq(payments.accountId, auth.accountId),
      eq(payments.deleted, false),
    ]

    if (query.customer) filters.push(eq(payments.customerId, String(query.customer)))
    if (query.billingType) filters.push(eq(payments.billingType, String(query.billingType)))
    if (query.status) filters.push(eq(payments.status, String(query.status)))
    if (query.anticipated !== undefined && query.anticipated !== '') {
      filters.push(eq(payments.anticipated, String(query.anticipated) === 'true'))
    }
    if (query.externalReference) {
      filters.push(eq(payments.externalReference, String(query.externalReference)))
    }

    const ranges = [
      ['dueDate', payments.dueDate],
      ['dateCreated', payments.dateCreated],
      ['estimatedCreditDate', payments.estimatedCreditDate],
    ] as const

    for (const [name, column] of ranges) {
      const ge = isoDateParam(query, `${name}[ge]`)
      const le = isoDateParam(query, `${name}[le]`)
      if (ge) filters.push(gte(column, ge))
      if (le) filters.push(lte(column, le))
    }

    const [row] = await ctx.db
      .select({
        quantity: count(),
        value: sum(payments.valueCents),
        netValue: sum(payments.netValueCents),
      })
      .from(payments)
      .where(and(...filters))

    // SUM() de zero linhas é NULL no SQLite — vira 0, não null.
    return {
      quantity: row?.quantity ?? 0,
      value: centsToBrl(cents(Number(row?.value ?? 0))),
      netValue: centsToBrl(cents(Number(row?.netValue ?? 0))),
    }
  },

  /**
   * GET /v3/finance/split/statistics — os splits que ainda vão se mover.
   *
   * TODO(regra): a spec dá só dois campos e duas descrições de uma linha
   * ("Amounts receivable" e "Values to be sent"), sem dizer quais status entram
   * na conta. Interpretamos:
   *   income → o que ESTA conta tem a RECEBER de splits de cobranças de outros;
   *   value  → o que ESTA conta tem a PAGAR de splits das suas próprias cobranças.
   * Em ambos, só os splits ainda abertos (PENDING/PROCESSING/AWAITING_CREDIT):
   * um split DONE já virou lançamento no extrato e contá-lo aqui seria contar o
   * mesmo dinheiro duas vezes.
   */
  'retrieve-split-values': async ({ ctx, auth }) => {
    const [income] = await ctx.db
      .select({ total: sum(paymentSplits.totalValueCents) })
      .from(paymentSplits)
      .where(
        and(
          eq(paymentSplits.recipientAccountId, auth.accountId),
          inArray(paymentSplits.status, [...OPEN_SPLIT_STATUSES]),
        ),
      )

    const [outcome] = await ctx.db
      .select({ total: sum(paymentSplits.totalValueCents) })
      .from(paymentSplits)
      .innerJoin(payments, eq(paymentSplits.paymentId, payments.id))
      .where(
        and(
          eq(payments.accountId, auth.accountId),
          inArray(paymentSplits.status, [...OPEN_SPLIT_STATUSES]),
        ),
      )

    return {
      income: centsToBrl(cents(Number(income?.total ?? 0))),
      value: centsToBrl(cents(Number(outcome?.total ?? 0))),
    }
  },
}
