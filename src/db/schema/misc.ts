/**
 * Tabelas dos módulos de cauda longa. Existem desde já para que o schema seja
 * criado UMA vez, na Fase 0 — assim os agentes que implementam cada módulo em
 * paralelo não precisam mexer no mesmo lugar e não conflitam.
 */
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { accounts } from './accounts.ts'
import { customers } from './customers.ts'
import { bool, cents, date, datetime, json } from './_conventions.ts'

export const paymentLinks = sqliteTable(
  'payment_links',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    name: text('name').notNull(),
    description: text('description'),
    billingType: text('billing_type').notNull(),
    /** DETACHED | RECURRENT | INSTALLMENT */
    chargeType: text('charge_type').notNull(),
    valueCents: cents('value_cents'),
    endDate: date('end_date'),
    dueDateLimitDays: cents('due_date_limit_days'),
    subscriptionCycle: text('subscription_cycle'),
    maxInstallmentCount: cents('max_installment_count'),
    notificationEnabled: bool('notification_enabled').notNull(),
    /** Obriga o preenchimento de endereço no checkout do link. */
    isAddressRequired: bool('is_address_required').notNull(),
    externalReference: text('external_reference'),
    callback: json<Record<string, unknown>>('callback'),
    url: text('url').notNull(),
    active: bool('active').notNull(),
    deleted: bool('deleted').notNull(),
    viewCount: cents('view_count').notNull(),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [
    index('payment_links_account_idx').on(t.accountId, t.deleted),
    index('payment_links_external_ref_idx').on(t.accountId, t.externalReference),
  ],
)

export const checkouts = sqliteTable(
  'checkouts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    /** ACTIVE | EXPIRED | PAID | CANCELED */
    status: text('status').notNull(),
    valueCents: cents('value_cents'),
    link: text('link').notNull(),
    expirationDate: datetime('expiration_date'),
    payload: json<Record<string, unknown>>('payload').notNull(),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('checkouts_account_idx').on(t.accountId, t.status)],
)

export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    paymentId: text('payment_id'),
    installmentId: text('installment_id'),
    customerId: text('customer_id').references(() => customers.id),
    /** SCHEDULED | SYNCHRONIZED | AUTHORIZED | PROCESSING_CANCELLATION | CANCELED | CANCELLATION_DENIED | ERROR */
    status: text('status').notNull(),
    valueCents: cents('value_cents').notNull(),
    deductionsCents: cents('deductions_cents'),
    serviceDescription: text('service_description'),
    observations: text('observations'),
    effectiveDate: date('effective_date'),
    number: text('number'),
    taxes: json<Record<string, unknown>>('taxes'),
    pdfUrl: text('pdf_url'),
    xmlUrl: text('xml_url'),
    rpsSerie: text('rps_serie'),
    rpsNumber: text('rps_number'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [
    index('invoices_account_idx').on(t.accountId, t.status),
    index('invoices_payment_idx').on(t.paymentId),
  ],
)

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    event: text('event').notNull(),
    enabled: bool('enabled').notNull(),
    emailEnabledForProvider: bool('email_enabled_for_provider').notNull(),
    smsEnabledForProvider: bool('sms_enabled_for_provider').notNull(),
    emailEnabledForCustomer: bool('email_enabled_for_customer').notNull(),
    smsEnabledForCustomer: bool('sms_enabled_for_customer').notNull(),
    phoneCallEnabledForCustomer: bool('phone_call_enabled_for_customer').notNull(),
    whatsappEnabledForCustomer: bool('whatsapp_enabled_for_customer').notNull(),
    scheduleOffset: cents('schedule_offset').notNull(),
    deleted: bool('deleted').notNull(),
  },
  (t) => [index('notifications_customer_idx').on(t.customerId)],
)

export const chargebacks = sqliteTable(
  'chargebacks',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    paymentId: text('payment_id').notNull(),
    installmentId: text('installment_id'),
    customerAccount: text('customer_account'),
    /** REQUESTED | IN_DISPUTE | DISPUTE_LOST | REVERSED | DONE */
    status: text('status').notNull(),
    reason: text('reason').notNull(),
    disputeStatus: text('dispute_status'),
    valueCents: cents('value_cents').notNull(),
    paymentDate: date('payment_date'),
    disputeStartDate: date('dispute_start_date'),
    deadlineToSendDisputeDocuments: date('deadline_to_send_dispute_documents'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('chargebacks_payment_idx').on(t.paymentId)],
)

export const bills = sqliteTable(
  'bills',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    /** PENDING | BANK_PROCESSING | PAID | FAILED | CANCELLED | REFUNDED */
    status: text('status').notNull(),
    valueCents: cents('value_cents').notNull(),
    feeCents: cents('fee_cents').notNull(),
    identificationField: text('identification_field'),
    barCode: text('bar_code'),
    dueDate: date('due_date'),
    scheduleDate: date('schedule_date'),
    paymentDate: date('payment_date'),
    description: text('description'),
    failReasons: text('fail_reasons'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('bills_account_idx').on(t.accountId, t.status)],
)

export const mobilePhoneRecharges = sqliteTable(
  'mobile_phone_recharges',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    /** PENDING | CONFIRMED | CANCELLED | REFUNDED */
    status: text('status').notNull(),
    phoneNumber: text('phone_number').notNull(),
    valueCents: cents('value_cents').notNull(),
    operatorName: text('operator_name'),
    canBeCancelled: bool('can_be_cancelled').notNull(),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('mobile_phone_recharges_account_idx').on(t.accountId, t.status)],
)

export const paymentDunnings = sqliteTable(
  'payment_dunnings',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    paymentId: text('payment_id').notNull(),
    /** CREDIT_BUREAU | DEBT_COLLECTION_ASSISTANCE */
    type: text('type').notNull(),
    status: text('status').notNull(),
    valueCents: cents('value_cents').notNull(),
    netValueCents: cents('net_value_cents').notNull(),
    feeCents: cents('fee_cents').notNull(),
    description: text('description'),
    requestDate: date('request_date').notNull(),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('payment_dunnings_account_idx').on(t.accountId, t.status)],
)

export const paymentDocuments = sqliteTable(
  'payment_documents',
  {
    id: text('id').primaryKey(),
    paymentId: text('payment_id').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    type: text('type').notNull(),
    name: text('name').notNull(),
    availableAfterPayment: bool('available_after_payment').notNull(),
    fileJson: json<Record<string, unknown>>('file_json'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('payment_documents_payment_idx').on(t.paymentId)],
)

// `account_documents` era um esboço da Fase 0 (uma tabela chapada, sem grupos) e
// nunca foi usado. O KYC real do Asaas tem dois níveis — o cliente LÊ grupos e
// ENVIA arquivo para um documento dentro do grupo —, então a tabela definitiva
// mora em `account-documents.ts`, junto com a de grupos.

export const creditBureauReports = sqliteTable(
  'credit_bureau_reports',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    customerId: text('customer_id'),
    cpfCnpj: text('cpf_cnpj'),
    state: text('state'),
    status: text('status').notNull(),
    feeCents: cents('fee_cents').notNull(),
    reportFile: text('report_file'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('credit_bureau_reports_account_idx').on(t.accountId)],
)

/** Configuração fiscal da conta (NF-e). Uma linha por conta. */
export const fiscalInfo = sqliteTable('fiscal_info', {
  accountId: text('account_id')
    .primaryKey()
    .references(() => accounts.id),
  data: json<Record<string, unknown>>('data').notNull(),
  updatedAt: datetime('updated_at').notNull(),
})
