/**
 * Antecipação de recebíveis. (Track D)
 *
 * O que acontece de verdade quando você antecipa:
 *
 *   HOJE            RECEIVABLE_ANTICIPATION_GROSS_CREDIT  +líquido da cobrança
 *                   RECEIVABLE_ANTICIPATION_FEE           −taxa da antecipação
 *   D+32 (liquida)  PAYMENT_RECEIVED                      +bruto
 *                   PAYMENT_FEE                           −taxa da cobrança
 *                   RECEIVABLE_ANTICIPATION_DEBIT         −líquido (já foi pago)
 *
 * Some tudo: o lojista fica com o líquido da cobrança MENOS a taxa de
 * antecipação — e o dinheiro entrou hoje, não em D+32. Os quatro lançamentos do
 * futuro se cancelam, e é por isso que o extrato continua fechando com o saldo.
 *
 * Errar isso é fácil e caro: creditar o BRUTO na antecipação faria o lojista
 * receber a taxa da cobrança de volta, e o saldo divergiria para sempre.
 */
import { and, eq, inArray } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { badRequest, invalid, notFound } from '../../core/errors.ts'
import { postEntries, type LedgerEntry } from '../../core/ledger.ts'
import type { DB } from '../../db/client.ts'
import { anticipations, payments, settings } from '../../db/schema/index.ts'
import { isAnticipableBillingType, quoteAnticipation } from '../../domain/anticipation.ts'
import type { AnticipationQuote } from '../../domain/anticipation.ts'
import type { BillingType } from '../../domain/fees.ts'
import * as ids from '../../domain/ids.ts'
import { cents } from '../../domain/money.ts'
import type { PaymentRow } from '../payments/serializer.ts'
import { serializeAnticipation, type AnticipationRow } from './serializer.ts'

/** Antecipações que ainda "ocupam" o recebível. */
const OPEN_STATUSES = ['PENDING', 'SCHEDULED', 'CREDITED'] as const

/**
 * TODO(regra): o limite de antecipação é uma análise de crédito do Asaas — não
 * há fórmula pública e nem poderia haver. Usamos um teto fixo e configurável por
 * ambiente, e descontamos dele o que já está antecipado e ainda não liquidou.
 * O número (R$ 50.000,00) é o do exemplo da própria spec.
 */
export const ANTICIPATION_LIMIT_CENTS = cents(5_000_000)

export interface AnticipationTarget {
  payment: PaymentRow
  quote: AnticipationQuote
  /** Cobrança confirmada → o dinheiro é certo, credita agora. */
  creditsNow: boolean
}

/**
 * Resolve a cobrança do body e valida se ela pode ser antecipada.
 *
 * `simulate` afrouxa só o que é de estado da antecipação (uma simulação não se
 * importa se já existe um pedido em curso) — as regras do recebível continuam
 * valendo.
 */
export async function resolveTarget(
  ctx: AppContext,
  auth: AuthContext,
  body: unknown,
  opts: { simulate: boolean },
): Promise<AnticipationTarget> {
  const b = (body ?? {}) as Record<string, any>

  if (b.installment) {
    // Honesto é dizer que não sabemos: parcelamento é o track E, e antecipar um
    // parcelamento tem regra própria (antecipa-se o conjunto de parcelas, não a
    // parcela). Devolver um número inventado aqui seria o pior desfecho.
    throw badRequest(
      'not_implemented',
      'A antecipação de parcelamento ainda não foi implementada neste simulador. ' +
        'Use `payment`.',
    )
  }
  if (!b.payment) {
    throw invalid('payment', 'Informe a cobrança a ser antecipada.')
  }

  const [row] = await ctx.db
    .select()
    .from(payments)
    .where(and(eq(payments.id, String(b.payment)), eq(payments.accountId, auth.accountId)))
    .limit(1)
  if (!row || row.deleted) throw notFound('Cobrança')

  const payment = row as PaymentRow
  const billingType = payment.billingType as BillingType

  if (!isAnticipableBillingType(billingType)) {
    throw invalid(
      'payment',
      'Só é possível antecipar cobranças de cartão de crédito ou boleto.',
    )
  }

  // PIX e dinheiro em espécie não chegam aqui. Sobram os estados do recebível:
  //   PENDING   → o pagador ainda não pagou   → antecipação SCHEDULED
  //   CONFIRMED → pago, aguardando o crédito  → antecipação CREDITED agora
  //   o resto   → não há recebível futuro para antecipar
  if (payment.status !== 'PENDING' && payment.status !== 'CONFIRMED') {
    throw invalid(
      'payment',
      `Não é possível antecipar uma cobrança com status ${payment.status}.`,
    )
  }

  if (!opts.simulate) {
    if (payment.anticipated) {
      throw invalid('payment', 'Esta cobrança já foi antecipada.')
    }
    const [open] = await ctx.db
      .select({ id: anticipations.id })
      .from(anticipations)
      .where(
        and(
          eq(anticipations.paymentId, payment.id),
          inArray(anticipations.status, [...OPEN_STATUSES]),
        ),
      )
      .limit(1)
    if (open) {
      throw invalid('payment', 'Já existe uma antecipação em andamento para esta cobrança.')
    }
  }

  const quote = quoteFor(ctx, payment)

  return { payment, quote, creditsNow: payment.status === 'CONFIRMED' }
}

/** A cotação. Pura por dentro — aqui só juntamos os argumentos. */
export function quoteFor(ctx: AppContext, payment: PaymentRow): AnticipationQuote {
  return quoteAnticipation({
    fees: ctx.config.fees,
    billingType: payment.billingType as BillingType,
    // TODO(regra): parcelamento é o track E. Com uma parcela só, a taxa é a de
    // cartão "avulso" — que é a mais cara das duas, então não subestimamos.
    installmentCount: 1,
    totalValueCents: cents(payment.valueCents),
    paymentFeeCents: cents(payment.feeCents),
    // `estimatedCreditDate` é preenchida na criação da cobrança e reescrita na
    // confirmação. É o dia em que o dinheiro cairia sem a antecipação.
    expectedCreditDate: payment.estimatedCreditDate ?? payment.dueDate,
    today: ctx.clock.today(),
  })
}

/**
 * Cria a antecipação. Se o recebível já está confirmado, o dinheiro entra AGORA.
 */
export async function requestAnticipation(
  ctx: AppContext,
  accountId: string,
  target: AnticipationTarget,
): Promise<Record<string, unknown>> {
  const { payment, quote, creditsNow } = target
  const today = ctx.clock.today()

  return ctx.db.transaction(async (tx) => {
    const db = tx as unknown as DB

    /**
     * COMPARE-AND-SWAP no `anticipated` da cobrança: dois pedidos simultâneos
     * para a mesma cobrança e só um passa. É a trava que impede antecipar o mesmo
     * recebível duas vezes — o defeito mais caro que este módulo pode ter.
     */
    const claimed = await db
      .update(payments)
      .set({ anticipated: true })
      .where(and(eq(payments.id, payment.id), eq(payments.anticipated, false)))
      .returning({ id: payments.id })

    if (!claimed.length) {
      throw invalid('payment', 'Esta cobrança já foi antecipada.')
    }

    const [row] = await db
      .insert(anticipations)
      .values({
        id: ids.anticipationId(ctx.rng), // UUID puro
        accountId,
        paymentId: payment.id,
        installmentId: payment.installmentId,
        status: creditsNow ? 'CREDITED' : 'SCHEDULED',
        totalValueCents: quote.totalValueCents,
        valueCents: quote.valueCents,
        feeCents: quote.feeCents,
        netValueCents: quote.netValueCents,
        anticipationDays: quote.anticipationDays,
        requestDate: today,
        anticipationDate: creditsNow ? today : null,
        dueDate: payment.estimatedCreditDate ?? payment.dueDate,
        denialObservation: null,
        dateCreated: today,
      })
      .returning()

    const anticipation = row as AnticipationRow

    if (creditsNow) {
      await postCredit(ctx, db, anticipation)
    }

    const body = serializeAnticipation(anticipation)
    await emitAnticipation(
      ctx,
      db,
      accountId,
      anticipation.id,
      creditsNow ? 'RECEIVABLE_ANTICIPATION_CREDITED' : 'RECEIVABLE_ANTICIPATION_SCHEDULED',
      body,
    )

    return body
  })
}

/** Os dois lançamentos do crédito. Chame DENTRO da transação. */
export async function postCredit(
  ctx: AppContext,
  db: DB,
  a: AnticipationRow,
): Promise<void> {
  const entries: LedgerEntry[] = [
    {
      accountId: a.accountId,
      type: 'RECEIVABLE_ANTICIPATION_GROSS_CREDIT',
      valueCents: cents(a.valueCents),
      description: 'Antecipação de recebível',
      anticipationId: a.id,
      paymentId: a.paymentId ?? undefined,
    },
  ]
  // Antecipar zero dias não custa nada — e um lançamento de R$ 0,00 no extrato
  // seria ruído.
  if (a.feeCents > 0) {
    entries.push({
      accountId: a.accountId,
      type: 'RECEIVABLE_ANTICIPATION_FEE',
      valueCents: cents(-a.feeCents),
      description: 'Taxa de antecipação de recebível',
      anticipationId: a.id,
      paymentId: a.paymentId ?? undefined,
    })
  }
  await postEntries(db, ctx, entries)
}

/**
 * O débito da liquidação. O recebível original acabou de entrar na conta
 * (PAYMENT_RECEIVED) — mas o lojista já recebeu esse dinheiro adiantado, então
 * ele sai agora.
 */
export async function postDebit(ctx: AppContext, db: DB, a: AnticipationRow): Promise<void> {
  await postEntries(db, ctx, [
    {
      accountId: a.accountId,
      type: 'RECEIVABLE_ANTICIPATION_DEBIT',
      valueCents: cents(-a.valueCents),
      description: 'Liquidação de antecipação de recebível',
      anticipationId: a.id,
      paymentId: a.paymentId ?? undefined,
    },
  ])
}

export async function emitAnticipation(
  ctx: AppContext,
  db: DB,
  accountId: string,
  anticipationId: string,
  event: string,
  resource: Record<string, unknown>,
): Promise<void> {
  await ctx.emit(db, {
    accountId,
    event,
    resourceType: 'anticipation',
    resourceId: anticipationId,
    resource,
  })
}

export async function cancelAnticipation(
  ctx: AppContext,
  auth: AuthContext,
  id: string,
): Promise<Record<string, unknown>> {
  return ctx.db.transaction(async (tx) => {
    const db = tx as unknown as DB

    const [row] = await db
      .select()
      .from(anticipations)
      .where(and(eq(anticipations.id, id), eq(anticipations.accountId, auth.accountId)))
      .limit(1)
    if (!row) throw notFound('Antecipação')

    /**
     * Antecipação CREDITED não se cancela: o dinheiro já está na conta. Desfazer
     * exigiria devolver o crédito e a taxa, e o Asaas não oferece isso — o que
     * existe é o débito na liquidação do recebível, que já está agendado.
     */
    if (row.status !== 'PENDING' && row.status !== 'SCHEDULED') {
      throw badRequest(
        'invalid_action',
        `Não é possível cancelar uma antecipação com status ${row.status}.`,
      )
    }

    const updated = await db
      .update(anticipations)
      .set({ status: 'CANCELLED' })
      .where(and(eq(anticipations.id, id), eq(anticipations.status, row.status)))
      .returning()

    if (!updated.length) {
      throw badRequest('conflict', 'A antecipação mudou de status durante a operação.')
    }

    const after = updated[0] as AnticipationRow

    // Solta o recebível: a cobrança volta a poder ser antecipada.
    if (after.paymentId) {
      await db
        .update(payments)
        .set({ anticipated: false })
        .where(eq(payments.id, after.paymentId))
    }

    const body = serializeAnticipation(after)
    await emitAnticipation(
      ctx,
      db,
      auth.accountId,
      after.id,
      'RECEIVABLE_ANTICIPATION_CANCELLED',
      body,
    )
    return body
  })
}

// ── Configuração da antecipação automática ────────────────────────────
//
// Uma linha por conta na tabela `settings` (chave/valor JSON). Não vale uma
// tabela nova: é um único booleano, e `settings` existe exatamente para isto.

export interface AutoAnticipationConfig {
  creditCardAutomaticEnabled: boolean
}

export const autoConfigKey = (accountId: string) => `anticipation:auto:${accountId}`

export async function getAutoConfig(
  db: DB,
  accountId: string,
): Promise<AutoAnticipationConfig> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, autoConfigKey(accountId)))
    .limit(1)

  const value = row?.value as AutoAnticipationConfig | undefined
  return { creditCardAutomaticEnabled: value?.creditCardAutomaticEnabled ?? false }
}

export async function setAutoConfig(
  ctx: AppContext,
  accountId: string,
  enabled: boolean,
): Promise<AutoAnticipationConfig> {
  const value: AutoAnticipationConfig = { creditCardAutomaticEnabled: enabled }

  await ctx.db
    .insert(settings)
    .values({ key: autoConfigKey(accountId), value, updatedAt: ctx.clock.timestamp() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: ctx.clock.timestamp() },
    })

  return value
}
