import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { accounts } from './accounts.ts'
import { bool, cents, date, datetime } from './_conventions.ts'

export const pixKeys = sqliteTable(
  'pix_keys',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    key: text('key'),
    /** CPF | CNPJ | EMAIL | PHONE | EVP */
    type: text('type').notNull(),
    /** AWAITING_ACTIVATION | ACTIVE | AWAITING_DELETION | AWAITING_ACCOUNT_DELETION | DELETED | ERROR */
    status: text('status').notNull(),
    qrCodePayload: text('qr_code_payload'),
    qrCodeEncodedImage: text('qr_code_encoded_image'),
    canBeDeleted: bool('can_be_deleted').notNull(),
    cannotBeDeletedReason: text('cannot_be_deleted_reason'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('pix_keys_account_idx').on(t.accountId, t.status)],
)

export const pixQrCodes = sqliteTable(
  'pix_qr_codes',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    /** Vinculado a uma cobrança (QR dinâmico) ou avulso (QR estático). */
    paymentId: text('payment_id'),
    pixKeyId: text('pix_key_id'),

    /** String EMV do Pix (copia-e-cola). */
    payload: text('payload').notNull(),
    encodedImage: text('encoded_image').notNull(),
    valueCents: cents('value_cents'),
    description: text('description'),
    externalReference: text('external_reference'),
    allowsMultiplePayments: bool('allows_multiple_payments').notNull(),
    expirationDate: datetime('expiration_date'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [
    index('pix_qr_codes_account_idx').on(t.accountId),
    index('pix_qr_codes_payment_idx').on(t.paymentId),
  ],
)

export const pixTransactions = sqliteTable(
  'pix_transactions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    paymentId: text('payment_id'),
    qrCodeId: text('qr_code_id'),

    /** CREDIT | DEBIT | CREDIT_REFUND | DEBIT_REFUND */
    type: text('type').notNull(),
    /** AWAITING_REQUEST | DONE | REFUSED | SCHEDULED | CANCELLED | ERROR */
    status: text('status').notNull(),
    valueCents: cents('value_cents').notNull(),
    endToEndIdentifier: text('end_to_end_identifier'),
    description: text('description'),
    scheduledDate: date('scheduled_date'),
    effectiveDate: datetime('effective_date'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('pix_transactions_account_idx').on(t.accountId, t.status)],
)
