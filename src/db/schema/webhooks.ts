import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { accounts } from './accounts.ts'
import { bool, cents, datetime, epochMs, json } from './_conventions.ts'

export const webhooks = sqliteTable(
  'webhooks',
  {
    id: text('id').primaryKey(), // UUID puro
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),

    name: text('name').notNull(),
    url: text('url').notNull(),
    email: text('email').notNull(),
    enabled: bool('enabled').notNull(),
    /** Vira true após WEBHOOK_MAX_ATTEMPTS falhas seguidas. Congela a fila. */
    interrupted: bool('interrupted').notNull(),
    /** Enviado no header `asaas-access-token`. 32–255 chars. */
    authToken: text('auth_token'),
    apiVersion: cents('api_version').notNull(),
    /** SEQUENTIALLY faz head-of-line blocking de verdade. */
    sendType: text('send_type', {
      enum: ['SEQUENTIALLY', 'NON_SEQUENTIALLY'],
    }).notNull(),
    events: json<string[]>('events').notNull(),

    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [index('webhooks_account_idx').on(t.accountId)],
)

/**
 * O evento de domínio. Um por acontecimento, independente de quantos webhooks
 * estejam inscritos.
 *
 * `payload` é CONGELADO no momento do emit. Uma retentativa 3 horas depois não
 * pode enviar o estado atual do recurso — o evento descreve um instante.
 */
export const webhookEvents = sqliteTable(
  'webhook_events',
  {
    id: text('id').primaryKey(), // evt_<hex32>&<n>
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    event: text('event').notNull(), // PAYMENT_RECEIVED, …
    resourceType: text('resource_type').notNull(), // payment, subscription, transfer…
    resourceId: text('resource_id').notNull(),
    payload: json<Record<string, unknown>>('payload').notNull(),
    dateCreated: datetime('date_created').notNull(),
    createdAtMs: epochMs('created_at_ms').notNull(),
  },
  (t) => [index('webhook_events_account_idx').on(t.accountId, t.createdAtMs)],
)

/** Uma entrega por (evento × webhook inscrito e habilitado). */
export const webhookDeliveries = sqliteTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    webhookId: text('webhook_id')
      .notNull()
      .references(() => webhooks.id),
    eventId: text('event_id')
      .notNull()
      .references(() => webhookEvents.id),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),

    /** Monotônico por webhook. É o que dá ordem ao modo SEQUENTIALLY. */
    sequence: epochMs('sequence').notNull(),

    /** PENDING | DELIVERED | FAILED | INTERRUPTED | EXPIRED */
    status: text('status').notNull(),
    attempt: cents('attempt').notNull(),
    nextAttemptAtMs: epochMs('next_attempt_at_ms'),
    lastAttemptAt: datetime('last_attempt_at'),
    /** Só HTTP 200 conta como sucesso no Asaas. 201 e 204 são falha. */
    lastStatusCode: cents('last_status_code'),
    lastError: text('last_error'),
    /** createdAt + WEBHOOK_RETENTION_DAYS (dias simulados). */
    expiresAtMs: epochMs('expires_at_ms').notNull(),
    dateCreated: datetime('date_created').notNull(),
  },
  (t) => [
    // O dispatcher varre por aqui a cada tick.
    index('webhook_deliveries_due_idx').on(t.webhookId, t.status, t.nextAttemptAtMs),
    // Ordem estrita para SEQUENTIALLY.
    uniqueIndex('webhook_deliveries_seq_uq').on(t.webhookId, t.sequence),
    index('webhook_deliveries_event_idx').on(t.eventId),
  ],
)
