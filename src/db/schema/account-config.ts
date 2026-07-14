/**
 * Estado da conta que a tabela `accounts` não modela: a personalização do
 * checkout (GET/POST /v3/myAccount/paymentCheckoutConfig) e a desabilitação da
 * subconta white label (DELETE /v3/myAccount).
 *
 * Ficam aqui, e não em `accounts`, porque são opcionais e de ciclo de vida
 * próprio — uma conta pode nunca ter personalização, e a desabilitação é um fato
 * datado, não um campo.
 */
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { accounts } from './accounts.ts'
import { bool, datetime } from './_conventions.ts'

/** Uma linha por conta. Personalização da tela de checkout/fatura. */
export const accountCheckoutConfigs = sqliteTable('account_checkout_configs', {
  accountId: text('account_id')
    .primaryKey()
    .references(() => accounts.id),
  logoBackgroundColor: text('logo_background_color'),
  infoBackgroundColor: text('info_background_color'),
  fontColor: text('font_color'),
  enabled: bool('enabled').notNull(),
  logoUrl: text('logo_url'),
  /** AWAITING_APPROVAL | APPROVED | REJECTED — em sandbox aprova sozinho. */
  status: text('status').notNull(),
  observations: text('observations'),
  updatedAt: datetime('updated_at').notNull(),
})

/** Subconta white label desabilitada via DELETE /v3/myAccount. */
export const accountDisablements = sqliteTable('account_disablements', {
  accountId: text('account_id')
    .primaryKey()
    .references(() => accounts.id),
  removeReason: text('remove_reason'),
  disabledAt: datetime('disabled_at').notNull(),
})
