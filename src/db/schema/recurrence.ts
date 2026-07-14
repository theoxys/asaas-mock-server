import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { accounts } from './accounts.ts'
import { customers } from './customers.ts'
import type { DiscountConfig, FineConfig, InterestConfig } from './payments.ts'
import { bool, cents, date, datetime, json } from './_conventions.ts'

/**
 * Parcelamento. As N cobranças nascem TODAS na criação (ao contrário da
 * assinatura, que gera sob demanda). A sobra de arredondamento vai na ÚLTIMA
 * parcela: R$ 350 em 12x → 11 × R$ 29,16 + R$ 29,24.
 */
export const installments = sqliteTable(
  'installments',
  {
    id: text('id').primaryKey(), // UUID puro, sem prefixo
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),

    billingType: text('billing_type').notNull(),
    installmentCount: cents('installment_count').notNull(),
    /** Valor de cada parcela (o da última pode diferir pela sobra). */
    installmentValueCents: cents('installment_value_cents').notNull(),
    /** Soma de todas as parcelas. */
    totalValueCents: cents('total_value_cents').notNull(),
    netValueCents: cents('net_value_cents').notNull(),

    /** Dia do mês em que cada parcela vence. */
    expirationDay: cents('expiration_day').notNull(),
    description: text('description'),
    paymentLinkId: text('payment_link_id'),
    checkoutSession: text('checkout_session'),
    transactionReceiptUrl: text('transaction_receipt_url'),

    deleted: bool('deleted').notNull(),
    dateCreated: date('date_created').notNull(),
  },
  (t) => [index('installments_account_idx').on(t.accountId, t.deleted)],
)

/**
 * Assinatura. A próxima cobrança NÃO é criada na hora: o Asaas a gera
 * SUBSCRIPTION_LOOKAHEAD_DAYS (padrão 40) antes do nextDueDate.
 */
export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(), // sub_<alfanum>
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),

    billingType: text('billing_type').notNull(),
    /** WEEKLY BIWEEKLY MONTHLY BIMONTHLY QUARTERLY SEMIANNUALLY YEARLY */
    cycle: text('cycle').notNull(),
    /** ACTIVE | INACTIVE | EXPIRED */
    status: text('status').notNull(),

    valueCents: cents('value_cents').notNull(),
    nextDueDate: date('next_due_date').notNull(),
    endDate: date('end_date'),
    maxPayments: cents('max_payments'),
    /** Quantas cobranças já foram geradas — para respeitar maxPayments. */
    paymentsGenerated: cents('payments_generated').notNull(),

    description: text('description'),
    externalReference: text('external_reference'),
    paymentLinkId: text('payment_link_id'),
    checkoutSession: text('checkout_session'),
    creditCardId: text('credit_card_id'),

    discount: json<DiscountConfig>('discount'),
    fine: json<FineConfig>('fine'),
    interest: json<InterestConfig>('interest'),

    deleted: bool('deleted').notNull(),
    dateCreated: date('date_created').notNull(),
  },
  (t) => [
    // Predicado do job de geração de cobrança de assinatura.
    index('subscriptions_generation_idx').on(t.status, t.nextDueDate),
    index('subscriptions_account_idx').on(t.accountId, t.deleted),
  ],
)

/**
 * Split da assinatura: serve de TEMPLATE, copiado para cada cobrança gerada.
 * Alterar aqui não mexe nas cobranças já criadas.
 */
export const subscriptionSplits = sqliteTable(
  'subscription_splits',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id')
      .notNull()
      .references(() => subscriptions.id),
    walletId: text('wallet_id').notNull(),
    fixedValueCents: cents('fixed_value_cents'),
    percentualValueE4: cents('percentual_value_e4'),
    /** ACTIVE | DISABLED */
    status: text('status').notNull(),
    disabledReason: text('disabled_reason'),
    externalReference: text('external_reference'),
    description: text('description'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('subscription_splits_sub_idx').on(t.subscriptionId)],
)
