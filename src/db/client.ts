import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from './schema/index.ts'

export type DB = ReturnType<typeof createDb>['db']

export function createDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

  const sqlite = new Database(path, { create: true })

  sqlite.exec('PRAGMA journal_mode = WAL')
  sqlite.exec('PRAGMA busy_timeout = 5000')
  sqlite.exec('PRAGMA foreign_keys = ON')
  sqlite.exec('PRAGMA synchronous = NORMAL')

  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

export { schema }
