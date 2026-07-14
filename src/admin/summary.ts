/**
 * O agregado que a home do painel mostra: "Situação das cobranças".
 *
 * Os quatro grupos são os do painel do Asaas, não os 15 status da máquina. É uma
 * TRADUÇÃO deliberada: `RECEIVED` e `RECEIVED_IN_CASH` são a mesma notícia para
 * quem olha ("o dinheiro entrou"), e `AWAITING_RISK_ANALYSIS` ainda é "esperando
 * pagamento" para o lojista, por mais que a máquina os distinga.
 *
 * O mapa vive AQUI, num lugar só. Se cada tela traduzisse status por conta
 * própria, duas telas acabariam discordando sobre o que é uma cobrança "recebida"
 * — e o número que não bate é sempre o que mina a confiança no simulador inteiro.
 */
import { eq } from 'drizzle-orm'
import type { AppContext } from '../core/context.ts'
import { payments } from '../db/schema/index.ts'

export type SummaryGroup = 'RECEIVED' | 'CONFIRMED' | 'AWAITING' | 'OVERDUE'

/** Status → grupo. Os que não caem em nenhum (REFUNDED, CHARGEBACK…) ficam fora. */
const GROUP_OF: Record<string, SummaryGroup> = {
  RECEIVED: 'RECEIVED',
  RECEIVED_IN_CASH: 'RECEIVED',
  DUNNING_RECEIVED: 'RECEIVED',

  CONFIRMED: 'CONFIRMED',
  AWAITING_CREDIT: 'CONFIRMED',

  PENDING: 'AWAITING',
  AUTHORIZED: 'AWAITING',
  AWAITING_RISK_ANALYSIS: 'AWAITING',

  OVERDUE: 'OVERDUE',
  DUNNING_REQUESTED: 'OVERDUE',
}

export interface GroupSummary {
  group: SummaryGroup
  /** Em REAIS — como toda fronteira de saída deste projeto. */
  value: number
  netValue: number
  count: number
  customers: number
  /** A barra segmentada do card: quanto de cada meio de pagamento. */
  byBillingType: Array<{ billingType: string; value: number; count: number }>
}

const EMPTY = (group: SummaryGroup): GroupSummary => ({
  group,
  value: 0,
  netValue: 0,
  count: 0,
  customers: 0,
  byBillingType: [],
})

export async function paymentsSummary(
  ctx: AppContext,
  accountId: string,
): Promise<GroupSummary[]> {
  const rows = await ctx.db
    .select({
      status: payments.status,
      billingType: payments.billingType,
      customerId: payments.customerId,
      valueCents: payments.valueCents,
      netValueCents: payments.netValueCents,
    })
    .from(payments)
    .where(eq(payments.accountId, accountId))

  const groups = new Map<SummaryGroup, GroupSummary>()
  const customers = new Map<SummaryGroup, Set<string>>()
  const types = new Map<SummaryGroup, Map<string, { cents: number; count: number }>>()

  for (const r of rows) {
    const g = GROUP_OF[r.status]
    if (!g) continue

    const acc = groups.get(g) ?? EMPTY(g)
    // Somamos em CENTAVOS e dividimos no fim: somar reais acumularia erro de
    // ponto flutuante, e o total do card deixaria de bater com a lista.
    acc.value += r.valueCents
    acc.netValue += r.netValueCents ?? r.valueCents
    acc.count += 1
    groups.set(g, acc)

    const cs = customers.get(g) ?? new Set()
    cs.add(r.customerId)
    customers.set(g, cs)

    const tm = types.get(g) ?? new Map()
    const t = tm.get(r.billingType) ?? { cents: 0, count: 0 }
    t.cents += r.valueCents
    t.count += 1
    tm.set(r.billingType, t)
    types.set(g, tm)
  }

  const order: SummaryGroup[] = ['RECEIVED', 'CONFIRMED', 'AWAITING', 'OVERDUE']

  return order.map((g) => {
    const acc = groups.get(g) ?? EMPTY(g)
    return {
      ...acc,
      value: acc.value / 100,
      netValue: acc.netValue / 100,
      customers: customers.get(g)?.size ?? 0,
      byBillingType: [...(types.get(g) ?? new Map())]
        .map(([billingType, t]) => ({ billingType, value: t.cents / 100, count: t.count }))
        .sort((a, b) => b.value - a.value),
    }
  })
}
