/**
 * KYC / onboarding: os documentos que uma conta precisa enviar para ser aprovada.
 *
 * São DUAS tabelas porque a API do Asaas expõe dois níveis: o cliente lê os
 * GRUPOS (`GET /v3/myAccount/documents`) e envia arquivo para um DOCUMENTO
 * (`POST /v3/myAccount/documents/{id}`, onde `{id}` é o id do documento que veio
 * dentro do grupo). Um grupo só fica APPROVED quando todos os documentos dele
 * estão APPROVED.
 *
 * Persistido, e não montado a cada request, porque o upload MUDA o status — um
 * grupo gerado on-the-fly nasceria pendente de novo depois de cada envio.
 */
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { accounts } from './accounts.ts'
import { datetime } from './_conventions.ts'

export const accountDocumentGroups = sqliteTable(
  'account_document_groups',
  {
    id: text('id').primaryKey(), // UUID
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),

    /** IDENTIFICATION | SOCIAL_CONTRACT | CUSTOM … (AccountDocumentType) */
    type: text('type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    /** NOT_SENT | PENDING | APPROVED | REJECTED | IGNORED */
    status: text('status').notNull(),

    /** Quem tem que enviar o documento. `name` é o nome da conta. */
    responsibleName: text('responsible_name'),
    /** INDIVIDUAL_COMPANY | LIMITED_COMPANY | MEI | ASAAS_ACCOUNT_OWNER … */
    responsibleType: text('responsible_type'),

    /** Link de envio. Some (null) quando o grupo é aprovado. */
    onboardingUrl: text('onboarding_url'),
    onboardingUrlExpirationDate: datetime('onboarding_url_expiration_date'),

    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('account_document_groups_account_idx').on(t.accountId)],
)

export const accountDocuments = sqliteTable(
  'account_documents',
  {
    id: text('id').primaryKey(), // UUID — é o `{id}` do POST de envio
    groupId: text('group_id')
      .notNull()
      .references(() => accountDocumentGroups.id),
    /** Redundante com o grupo, mas é o que permite achar o documento da conta
     * autenticada em UMA consulta — o isolamento por conta não pode depender de
     * um JOIN que alguém esqueça de escrever. */
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),

    /** NOT_SENT | PENDING | APPROVED | REJECTED */
    status: text('status').notNull(),

    fileName: text('file_name'),
    sentAt: datetime('sent_at'),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('account_documents_group_idx').on(t.groupId)],
)
