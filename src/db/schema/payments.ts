import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { accounts } from './accounts.ts'
import { customers } from './customers.ts'
import { bool, cents, date, datetime, json } from './_conventions.ts'

/** Regras de desconto/multa/juros embutidas na cobrança. */
export interface DiscountConfig {
  value: number
  dueDateLimitDays: number
  type: 'FIXED' | 'PERCENTAGE'
}
export interface FineConfig {
  value: number
  type: 'FIXED' | 'PERCENTAGE'
}
/** `interest` só tem `value` — é sempre percentual AO MÊS. Não existe `type`. */
export interface InterestConfig {
  value: number
}
export interface CallbackConfig {
  successUrl: string
  autoRedirect?: boolean
}

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(), // pay_<12 dígitos>
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),

    /** Agrupadores. Um payment pertence a no máximo um de cada. */
    subscriptionId: text('subscription_id'),
    installmentId: text('installment_id'),
    installmentNumber: text('installment_number'),
    paymentLinkId: text('payment_link_id'),
    checkoutSession: text('checkout_session'),

    billingType: text('billing_type').notNull(),
    status: text('status').notNull(),

    /**
     * `value` é o valor A PAGAR: depois de vencer, passa a incluir juros e multa.
     * `originalValue` guarda o valor de antes do atraso (null se nunca atrasou).
     * `interestValue` = multa + juros.
     * `netValue` = value − taxa do Asaas. É a base do split.
     */
    valueCents: cents('value_cents').notNull(),
    netValueCents: cents('net_value_cents').notNull(),
    originalValueCents: cents('original_value_cents'),
    interestValueCents: cents('interest_value_cents'),
    /** A taxa cobrada pelo Asaas nesta cobrança. Só é debitada se for paga. */
    feeCents: cents('fee_cents').notNull(),

    description: text('description'),
    externalReference: text('external_reference'),

    dueDate: date('due_date').notNull(),
    /** Vencimento no ato da criação. Imutável. */
    originalDueDate: date('original_due_date').notNull(),
    /** Data em que o Asaas liquidou. */
    paymentDate: date('payment_date'),
    /** Data em que o pagador de fato pagou. */
    clientPaymentDate: date('client_payment_date'),
    confirmedDate: date('confirmed_date'),
    /** Quando o dinheiro virou saldo. Preenchido ao entrar em RECEIVED. */
    creditDate: date('credit_date'),
    estimatedCreditDate: date('estimated_credit_date'),

    discount: json<DiscountConfig>('discount'),
    fine: json<FineConfig>('fine'),
    interest: json<InterestConfig>('interest'),
    callback: json<CallbackConfig>('callback'),

    creditCardId: text('credit_card_id'),
    pixQrCodeId: text('pix_qr_code_id'),
    pixTransactionId: text('pix_transaction_id'),

    invoiceUrl: text('invoice_url'),
    bankSlipUrl: text('bank_slip_url'),
    transactionReceiptUrl: text('transaction_receipt_url'),
    invoiceNumber: text('invoice_number'),
    nossoNumero: text('nosso_numero'),

    /** 0 = registro do boleto cancela ao vencer. null = padrão da conta. */
    daysAfterDueDateToRegistrationCancellation: cents(
      'days_after_due_date_to_registration_cancellation',
    ),
    postalService: bool('postal_service').notNull(),
    canBePaidAfterDueDate: bool('can_be_paid_after_due_date').notNull(),

    anticipated: bool('anticipated').notNull(),
    anticipable: bool('anticipable').notNull(),
    deleted: bool('deleted').notNull(),

    lastInvoiceViewedDate: datetime('last_invoice_viewed_date'),
    lastBankSlipViewedDate: datetime('last_bank_slip_viewed_date'),
    dateCreated: date('date_created').notNull(),
    createdAtMs: cents('created_at_ms').notNull(), // ordenação estável
  },
  (t) => [
    // Predicados dos jobs do scheduler — estes dois índices são o que mantém o
    // tick barato quando a base cresce.
    index('payments_overdue_idx').on(t.status, t.dueDate),
    index('payments_credit_idx').on(t.status, t.creditDate),

    index('payments_account_idx').on(t.accountId, t.status),
    index('payments_customer_idx').on(t.accountId, t.customerId),
    index('payments_subscription_idx').on(t.subscriptionId),
    index('payments_installment_idx').on(t.installmentId),
    index('payments_external_ref_idx').on(t.accountId, t.externalReference),
  ],
)

export const paymentSplits = sqliteTable(
  'payment_splits',
  {
    id: text('id').primaryKey(), // UUID
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id),
    /** Carteira de destino. Pode ser de uma conta que não existe aqui. */
    walletId: text('wallet_id').notNull(),
    /** Resolvido quando o walletId é de uma conta deste servidor. */
    recipientAccountId: text('recipient_account_id'),

    fixedValueCents: cents('fixed_value_cents'),
    /** 4 casas decimais → escala 1e4. 92.3444% = 923444. */
    percentualValueE4: cents('percentual_value_e4'),
    totalFixedValueCents: cents('total_fixed_value_cents'),

    /** O valor de fato calculado sobre o netValue da cobrança. */
    totalValueCents: cents('total_value_cents'),

    /** PENDING PROCESSING PROCESSING_REFUND AWAITING_CREDIT CANCELLED DONE REFUNDED BLOCKED_BY_VALUE_DIVERGENCE */
    status: text('status').notNull(),
    cancellationReason: text('cancellation_reason'),
    refusalReason: text('refusal_reason'),

    /** Prazo para ajustar um split bloqueado por divergência (2 dias úteis). */
    blockedUntil: date('blocked_until'),
    creditDate: date('credit_date'),

    externalReference: text('external_reference'),
    description: text('description'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [
    index('payment_splits_payment_idx').on(t.paymentId),
    index('payment_splits_status_idx').on(t.status, t.blockedUntil),
    index('payment_splits_wallet_idx').on(t.walletId),
  ],
)

export const paymentRefunds = sqliteTable(
  'payment_refunds',
  {
    id: text('id').primaryKey(),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id),
    /** PENDING | AWAITING_CRITICAL_ACTION_AUTHORIZATION | CANCELLED | DONE */
    status: text('status').notNull(),
    valueCents: cents('value_cents').notNull(),
    description: text('description'),
    /** Taxas NÃO são devolvidas num estorno — o Asaas retém. */
    refundedFeeCents: cents('refunded_fee_cents').notNull(),
    effectiveDate: date('effective_date'),
    transactionReceiptUrl: text('transaction_receipt_url'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('payment_refunds_payment_idx').on(t.paymentId)],
)

export const creditCards = sqliteTable(
  'credit_cards',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    customerId: text('customer_id').references(() => customers.id),

    creditCardToken: text('credit_card_token').notNull(), // UUID
    /** Só os 4 últimos dígitos — nunca guardamos o PAN. */
    last4: text('last4').notNull(),
    brand: text('brand').notNull(),
    holderName: text('holder_name').notNull(),
    expiryMonth: text('expiry_month').notNull(),
    expiryYear: text('expiry_year').notNull(),

    /**
     * O desfecho da AUTORIZAÇÃO, decidido na tokenização e carregado pelo token —
     * é o que faz um cartão recusado continuar recusando quando cobrado pelo
     * token, como no Asaas.
     *
     * Só os desfechos de autorização chegam aqui. Os de validação (expirado, CVV
     * ausente…) recusam a requisição na porta e nenhum token nasce.
     * Ver `src/domain/credit-card.ts`.
     */
    simulatedOutcome: text('simulated_outcome', {
      enum: ['APPROVE', 'DECLINE'],
    }).notNull(),

    holderInfo: json<Record<string, unknown>>('holder_info'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [
    index('credit_cards_token_idx').on(t.creditCardToken),
    index('credit_cards_account_idx').on(t.accountId),
  ],
)
