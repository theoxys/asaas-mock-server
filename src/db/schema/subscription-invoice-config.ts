/**
 * Configuração de emissão automática de nota fiscal de uma assinatura. (Track E)
 *
 * Uma linha por assinatura — a API é um CRUD de recurso único
 * (`/v3/subscriptions/{id}/invoiceSettings`), não uma coleção.
 *
 * `taxes` fica em JSON: são PERCENTUAIS (ISS, PIS, COFINS…), não dinheiro — a
 * regra dos centavos não se aplica. Já `deductions` É dinheiro, e por isso é
 * inteiro em centavos como manda a convenção.
 *
 * A NF em si (emissão, PDF, XML) é do track G; aqui guardamos só a política de
 * quando emiti-la.
 */
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { accounts } from './accounts.ts'
import { subscriptions } from './recurrence.ts'
import { bool, cents, datetime, json } from './_conventions.ts'

/** Os percentuais da nota. Espelha InvoiceTaxesRequest da spec. */
export interface InvoiceTaxesConfig {
  retainIss: boolean
  iss: number
  pis: number
  cofins: number
  csll: number
  inss: number
  ir: number
  [extra: string]: unknown
}

export const subscriptionInvoiceConfigs = sqliteTable('subscription_invoice_configs', {
  subscriptionId: text('subscription_id')
    .primaryKey()
    .references(() => subscriptions.id),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),

  municipalServiceId: text('municipal_service_id'),
  municipalServiceCode: text('municipal_service_code'),
  municipalServiceName: text('municipal_service_name'),

  /** Dinheiro → centavos. Deduções não mudam o valor da nota, mudam a base do ISS. */
  deductionsCents: cents('deductions_cents'),

  /**
   * No request o campo chama `effectiveDatePeriod`; na resposta,
   * `invoiceCreationPeriod`. É o mesmo dado — a spec do Asaas troca o nome.
   * ON_PAYMENT_CONFIRMATION | ON_PAYMENT_DUE_DATE | BEFORE_PAYMENT_DUE_DATE |
   * ON_DUE_DATE_MONTH | ON_NEXT_MONTH
   */
  invoiceCreationPeriod: text('invoice_creation_period'),
  daysBeforeDueDate: cents('days_before_due_date'),
  receivedOnly: bool('received_only'),
  /** Atualiza o valor da cobrança já descontando os impostos da nota. */
  updatePayment: bool('update_payment'),
  observations: text('observations'),

  taxes: json<InvoiceTaxesConfig>('taxes'),

  dateCreated: datetime('date_created').notNull(),
})
