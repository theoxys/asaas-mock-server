import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { accounts } from './accounts.ts'
import { bool, datetime } from './_conventions.ts'

export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(), // cus_<12 dígitos>
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),

    name: text('name').notNull(),
    cpfCnpj: text('cpf_cnpj').notNull(), // validado com dígito verificador
    personType: text('person_type', { enum: ['FISICA', 'JURIDICA'] }).notNull(), // derivado do cpfCnpj
    email: text('email'),
    phone: text('phone'),
    mobilePhone: text('mobile_phone'),

    address: text('address'),
    addressNumber: text('address_number'),
    complement: text('complement'),
    province: text('province'),
    postalCode: text('postal_code'),
    city: text('city'), // id numérico da cidade no Asaas
    cityName: text('city_name'),
    state: text('state'),
    country: text('country'),

    externalReference: text('external_reference'),
    notificationDisabled: bool('notification_disabled').notNull(),
    additionalEmails: text('additional_emails'), // CSV
    municipalInscription: text('municipal_inscription'),
    stateInscription: text('state_inscription'),
    observations: text('observations'),
    groupName: text('group_name'),
    company: text('company'),
    foreignCustomer: bool('foreign_customer'),

    deleted: bool('deleted').notNull(),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [
    index('customers_account_idx').on(t.accountId, t.deleted),
    index('customers_cpf_idx').on(t.accountId, t.cpfCnpj),
    index('customers_external_ref_idx').on(t.accountId, t.externalReference),
  ],
)
