/**
 * Imagens de um link de pagamento.
 *
 * Tabela própria (e não um JSON dentro de `payment_links`) porque a API do Asaas
 * trata cada imagem como um RECURSO: ela tem id próprio, é recuperável sozinha,
 * removível sozinha, e exatamente uma delas é a principal (`main`). Guardar isso
 * num array JSON transformaria "definir a imagem principal" num read-modify-write
 * do link inteiro — e duas requisições concorrentes perderiam uma das imagens.
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { bool, datetime } from './_conventions.ts'
import { paymentLinks } from './misc.ts'

export const paymentLinkImages = sqliteTable(
  'payment_link_images',
  {
    id: text('id').primaryKey(), // UUID
    paymentLinkId: text('payment_link_id')
      .notNull()
      .references(() => paymentLinks.id),
    /** Exatamente uma imagem por link é a principal. */
    main: bool('main').notNull(),
    originalName: text('original_name').notNull(),
    /** Tamanho do arquivo em bytes. NÃO é dinheiro — por isso não tem sufixo Cents. */
    size: integer('size', { mode: 'number' }).notNull(),
    extension: text('extension').notNull(),
    /** Token opaco que compõe as URLs de preview/download, como no Asaas. */
    publicToken: text('public_token').notNull(),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('payment_link_images_link_idx').on(t.paymentLinkId)],
)
