import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { datetime, epochMs, json } from './_conventions.ts'

/** Overrides de runtime (tabela de taxas, lookahead de assinatura…). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: json<unknown>('value').notNull(),
  updatedAt: datetime('updated_at').notNull(),
})

/**
 * O relógio virtual, persistido — senão a viagem no tempo se perderia a cada
 * restart do container e o estado do banco ficaria "no futuro" em relação a ele.
 */
export const clockState = sqliteTable('clock_state', {
  id: integer('id').primaryKey(), // sempre 1
  mode: text('mode', {
    enum: ['REAL', 'VIRTUAL_FLOWING', 'VIRTUAL_FROZEN'],
  }).notNull(),
  /** VIRTUAL_FROZEN: o instante congelado. VIRTUAL_FLOWING: base do offset. */
  virtualEpochMs: epochMs('virtual_epoch_ms'),
  /** VIRTUAL_FLOWING: real de referência, para calcular o offset. */
  anchorRealEpochMs: epochMs('anchor_real_epoch_ms'),
  updatedAt: datetime('updated_at').notNull(),
})

/**
 * Guarda de idempotência dos jobs diários. `tickKey` é o DIA SIMULADO
 * ('2026-02-14'), então dar tick 10 vezes no mesmo dia roda cada job uma vez só.
 */
export const jobRuns = sqliteTable(
  'job_runs',
  {
    jobName: text('job_name').notNull(),
    tickKey: text('tick_key').notNull(),
    ranAt: datetime('ran_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.jobName, t.tickKey] })],
)

/** Contadores monotônicos: o `&<n>` do id de evento, o `sequence` por webhook. */
export const sequences = sqliteTable('sequences', {
  name: text('name').primaryKey(),
  value: integer('value').notNull(),
})
