import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { bool, cents, datetime } from './_conventions.ts'

/**
 * Cada API key pertence a uma conta. Cada conta tem walletId e saldo próprios.
 * É isso que torna o split testável de verdade: o dinheiro sai de uma conta e
 * entra na outra, e os dois extratos fecham.
 */
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(), // UUID
    walletId: text('wallet_id').notNull(), // UUID — o destino de um split
    /** Subconta criada via POST /v3/accounts. null = conta raiz. */
    parentAccountId: text('parent_account_id'),

    name: text('name').notNull(),
    /** Razão social. Só faz sentido para conta JURIDICA. */
    companyName: text('company_name'),
    /** Nome de exibição. O Asaas preenche sozinho a partir da razão social. */
    tradingName: text('trading_name'),
    email: text('email').notNull(),
    loginEmail: text('login_email'),
    cpfCnpj: text('cpf_cnpj').notNull(),
    personType: text('person_type', { enum: ['FISICA', 'JURIDICA'] }).notNull(),
    companyType: text('company_type'),
    birthDate: text('birth_date'),
    mobilePhone: text('mobile_phone'),
    phone: text('phone'),
    site: text('site'),

    address: text('address'),
    addressNumber: text('address_number'),
    complement: text('complement'),
    province: text('province'),
    postalCode: text('postal_code'),
    city: text('city'),
    state: text('state'),
    country: text('country').notNull(),

    incomeCents: cents('income_cents'),

    /** PENDING | APPROVED | REJECTED — em sandbox aprova sozinho. */
    status: text('status').notNull(),

    /**
     * Saldo materializado. Escrito na MESMA transação do lançamento no ledger.
     * Invariante checado nos testes:
     *   balanceCents === SUM(financial_transactions.value_cents WHERE accountId)
     */
    balanceCents: cents('balance_cents').notNull(),

    accountNumber: text('account_number'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [
    uniqueIndex('accounts_wallet_id_uq').on(t.walletId),
    index('accounts_parent_idx').on(t.parentAccountId),
  ],
)

export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    /** `$aact_hmlg_…` — o valor do header `access_token`. */
    key: text('key').notNull(),
    name: text('name').notNull(),
    active: bool('active').notNull(),
    dateCreated: datetime('date_created').notNull(),
    expirationDate: text('expiration_date'),
  },
  (t) => [
    uniqueIndex('api_keys_key_uq').on(t.key), // caminho quente: toda requisição
    index('api_keys_account_idx').on(t.accountId),
  ],
)
