/**
 * Assinatura — o que a criação e o job de geração compartilham. (Track E)
 */
import { and, eq } from 'drizzle-orm'
import type { AppContext } from '../../core/context.ts'
import { invalid } from '../../core/errors.ts'
import type { DB } from '../../db/client.ts'
import { accounts, subscriptions, subscriptionSplits } from '../../db/schema/index.ts'
import { advanceCycle, type Cycle } from '../../domain/calendar.ts'
import type { BillingType } from '../../domain/fees.ts'
import { brlToCents, cents, percentE4, type Cents, type PercentE4 } from '../../domain/money.ts'
import type { SplitSpec } from '../../domain/split.ts'
import type { TickReport } from '../../scheduler/scheduler.ts'
import { createPayment } from '../payments/service.ts'

export type SubscriptionRow = typeof subscriptions.$inferSelect

export interface SubscriptionSplitInput {
  walletId: string
  fixedValueCents: Cents | null
  percentualValueE4: PercentE4 | null
  externalReference: string | null
  description: string | null
}

/**
 * O split da assinatura NÃO tem `totalFixedValue` — não há um "total" a repartir,
 * porque a assinatura não tem fim conhecido. Só `fixedValue` (por cobrança) e
 * `percentualValue`.
 */
export function parseSubscriptionSplits(raw: unknown): SubscriptionSplitInput[] {
  if (!Array.isArray(raw)) return []

  return raw.map((s: any) => {
    const walletId = String(s.walletId ?? '')
    if (!walletId) throw invalid('split', 'O walletId é obrigatório para cada split.')

    return {
      walletId,
      fixedValueCents:
        s.fixedValue !== undefined && s.fixedValue !== null
          ? brlToCents(Number(s.fixedValue))
          : null,
      // 4 casas decimais → escala 1e4. 92.3444% → 923444.
      percentualValueE4:
        s.percentualValue !== undefined && s.percentualValue !== null
          ? percentE4(Math.round(Number(s.percentualValue) * 10_000))
          : null,
      externalReference: s.externalReference ?? null,
      description: s.description ?? null,
    }
  })
}

/**
 * O TEMPLATE de split da assinatura, lido no formato que `createPayment` espera.
 *
 * É copiado para CADA cobrança gerada. Mexer no template não altera as cobranças
 * já criadas — e é isso que o desenho de "template" quer dizer: a assinatura
 * descreve o futuro, a cobrança congela o passado.
 */
export async function splitTemplateOf(db: DB, subscriptionId: string): Promise<SplitSpec[]> {
  const rows = await db
    .select()
    .from(subscriptionSplits)
    .where(
      and(
        eq(subscriptionSplits.subscriptionId, subscriptionId),
        eq(subscriptionSplits.status, 'ACTIVE'),
      ),
    )

  return rows.map((s) => ({
    walletId: s.walletId,
    fixedValueCents: (s.fixedValueCents ?? null) as Cents | null,
    percentualValueE4: (s.percentualValueE4 ?? null) as PercentE4 | null,
    externalReference: s.externalReference,
    description: s.description,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// GERAÇÃO DE COBRANÇA
//
// Mora aqui, e não no job, porque tem DOIS chamadores — e descobrir isso custou
// caro: nós acreditávamos que o Asaas só gerava a cobrança quando o vencimento
// entrava na janela de 40 dias. Errado. Provado contra o sandbox real:
//
//   POST /v3/subscriptions com nextDueDate = hoje+60
//     → devolve nextDueDate = hoje+90  (JÁ AVANÇOU um ciclo)
//     → e a cobrança de hoje+60 JÁ EXISTE, criada na hora.
//
// Ou seja: a PRIMEIRA cobrança nasce na criação, sempre, independente de quão
// distante seja o vencimento. A janela de lookahead governa as SEGUINTES.
//
// Nosso simulador criava ZERO cobranças. Uma assinatura que não cobra nada é
// uma assinatura quebrada — e o teste que a "provava" só provava a nossa leitura
// errada da documentação.
// ─────────────────────────────────────────────────────────────────────────────

/** Estourou o teto de cobranças? */
function reachedMaxPayments(sub: SubscriptionRow): boolean {
  return sub.maxPayments !== null && sub.paymentsGenerated >= sub.maxPayments
}

/** O próximo vencimento já passou do fim contratado? */
function pastEndDate(sub: SubscriptionRow, dueDate: string): boolean {
  return sub.endDate !== null && dueDate > sub.endDate
}

/** ACTIVE → EXPIRED, com CAS. Sem cobrança nova. */
async function expire(ctx: AppContext, sub: SubscriptionRow): Promise<void> {
  await ctx.db
    .update(subscriptions)
    .set({ status: 'EXPIRED' })
    .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.status, 'ACTIVE')))
}

/**
 * Gera UMA cobrança e avança o ciclo. Devolve a assinatura já atualizada, ou
 * `null` quando não há mais nada a fazer (expirou, ou outro tick chegou antes).
 */
export async function generateOne(
  ctx: AppContext,
  sub: SubscriptionRow,
  report?: TickReport,
): Promise<SubscriptionRow | null> {
  const dueDate = sub.nextDueDate

  // Teto de cobranças ou fim do contrato: expira ANTES de gerar.
  if (reachedMaxPayments(sub) || pastEndDate(sub, dueDate)) {
    await expire(ctx, sub)
    return null
  }

  const nextDueDate = advanceCycle(dueDate, sub.cycle as Cycle)
  const generated = sub.paymentsGenerated + 1

  /**
   * Esta cobrança é a última? Duas razões possíveis: bateu no `maxPayments`, ou o
   * PRÓXIMO vencimento cairia depois do `endDate`. Nos dois casos a assinatura
   * termina em EXPIRED — e o cliente descobre isso na mesma resposta.
   */
  const willExpire =
    (sub.maxPayments !== null && generated >= sub.maxPayments) ||
    (sub.endDate !== null && nextDueDate > sub.endDate)

  const walletId = await ownWalletId(ctx, sub.accountId)

  return ctx.db.transaction(async (tx) => {
    // ── COMPARE-AND-SWAP: reclama o vencimento antes de gastar qualquer coisa.
    const claimed = await tx
      .update(subscriptions)
      .set({
        nextDueDate,
        paymentsGenerated: generated,
        status: willExpire ? 'EXPIRED' : 'ACTIVE',
      })
      .where(
        and(
          eq(subscriptions.id, sub.id),
          eq(subscriptions.status, 'ACTIVE'),
          eq(subscriptions.nextDueDate, dueDate),
        ),
      )
      .returning()

    // Zero linhas: alguém já gerou a cobrança deste vencimento. Não é erro — é a
    // proteção funcionando.
    if (!claimed.length) return null

    const payment = await createPayment(ctx, tx as never, sub.accountId, walletId, {
      customerId: sub.customerId,
      billingType: sub.billingType as BillingType,
      valueCents: cents(sub.valueCents),
      dueDate,
      description: sub.description,
      externalReference: sub.externalReference,
      discount: sub.discount,
      fine: sub.fine,
      interest: sub.interest,
      // O template de split é COPIADO para a cobrança. A partir daqui os dois
      // vivem vidas separadas.
      splits: await splitTemplateOf(tx as never, sub.id),
      subscriptionId: sub.id,
      creditCardId: sub.creditCardId,
    })

    report?.created.push({
      resource: 'payment',
      id: payment.id,
      job: 'subscription-generation',
    })

    return claimed[0] as SubscriptionRow
  })
}

/** A carteira da conta emissora — o split não pode apontar para ela mesma. */
async function ownWalletId(ctx: AppContext, accountId: string): Promise<string> {
  const [row] = await ctx.db
    .select({ walletId: accounts.walletId })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)
  return row?.walletId ?? ''
}

