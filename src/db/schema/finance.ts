import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { accounts } from './accounts.ts'
import { bool, cents, date, datetime, json } from './_conventions.ts'

/**
 * O ledger. Append-only, com saldo corrente materializado.
 *
 * `valueCents` é ASSINADO: crédito positivo, débito negativo.
 * `balanceCents` é o saldo DEPOIS deste lançamento.
 *
 * Um recebimento de cobrança gera DOIS lançamentos: PAYMENT_RECEIVED (+bruto) e
 * PAYMENT_FEE (−taxa). É assim que o extrato do Asaas mostra.
 */
export const financialTransactions = sqliteTable(
  'financial_transactions',
  {
    id: text('id').primaryKey(),
    /** Ordem de inserção. Torna o extrato estável mesmo dentro do mesmo segundo. */
    seq: integer('seq').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),

    type: text('type').notNull(), // PAYMENT_RECEIVED, PAYMENT_FEE, TRANSFER…
    valueCents: cents('value_cents').notNull(), // assinado
    balanceCents: cents('balance_cents').notNull(), // saldo após
    description: text('description'),
    date: date('date').notNull(),

    paymentId: text('payment_id'),
    splitId: text('split_id'),
    transferId: text('transfer_id'),
    anticipationId: text('anticipation_id'),
    billId: text('bill_id'),
    invoiceId: text('invoice_id'),
    paymentDunningId: text('payment_dunning_id'),
    creditBureauReportId: text('credit_bureau_report_id'),

    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [
    index('financial_transactions_account_idx').on(t.accountId, t.seq),
    index('financial_transactions_payment_idx').on(t.paymentId),
  ],
)

export interface BankAccountInfo {
  bank?: { ispb?: string; code?: string; name?: string }
  accountName?: string
  ownerName?: string
  cpfCnpj?: string
  agency?: string
  agencyDigit?: string
  account?: string
  accountDigit?: string
  bankAccountType?: string
}

export const transfers = sqliteTable(
  'transfers',
  {
    id: text('id').primaryKey(), // UUID puro
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),

    /** BANK_ACCOUNT | PIX | INTERNAL */
    type: text('type').notNull(),
    /** PIX | TED | INTERNAL */
    operationType: text('operation_type'),
    /** PENDING | BANK_PROCESSING | DONE | CANCELLED | FAILED */
    status: text('status').notNull(),

    valueCents: cents('value_cents').notNull(),
    netValueCents: cents('net_value_cents').notNull(),
    transferFeeCents: cents('transfer_fee_cents').notNull(),

    /** Preenchido em transferência interna entre contas deste servidor. */
    destinationWalletId: text('destination_wallet_id'),
    destinationAccountId: text('destination_account_id'),

    bankAccount: json<BankAccountInfo>('bank_account'),
    pixAddressKey: text('pix_address_key'),
    pixAddressKeyType: text('pix_address_key_type'),
    endToEndIdentifier: text('end_to_end_identifier'),

    description: text('description'),
    externalReference: text('external_reference'),
    scheduleDate: date('schedule_date'),
    effectiveDate: date('effective_date'),
    failReason: text('fail_reason'),
    authorized: bool('authorized').notNull(),
    transactionReceiptUrl: text('transaction_receipt_url'),

    dateCreated: date('date_created').notNull(),
  },
  (t) => [
    index('transfers_account_idx').on(t.accountId, t.status),
    index('transfers_schedule_idx').on(t.status, t.scheduleDate),
  ],
)

export const anticipations = sqliteTable(
  'anticipations',
  {
    id: text('id').primaryKey(), // UUID puro
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),

    paymentId: text('payment_id'),
    installmentId: text('installment_id'),

    /** PENDING | SCHEDULED | DENIED | CREDITED | DEBITED | CANCELLED | OVERDUE */
    status: text('status').notNull(),

    /** Valor bruto do recebível antecipado. */
    totalValueCents: cents('total_value_cents').notNull(),
    /** Valor base (após taxa da cobrança). */
    valueCents: cents('value_cents').notNull(),
    feeCents: cents('fee_cents').notNull(),
    netValueCents: cents('net_value_cents').notNull(),
    anticipationDays: cents('anticipation_days').notNull(),

    requestDate: date('request_date').notNull(),
    anticipationDate: date('anticipation_date'),
    dueDate: date('due_date'),
    denialObservation: text('denial_observation'),

    dateCreated: date('date_created').notNull(),
  },
  (t) => [
    index('anticipations_account_idx').on(t.accountId, t.status),
    index('anticipations_payment_idx').on(t.paymentId),
    index('anticipations_settle_idx').on(t.status, t.dueDate),
  ],
)
