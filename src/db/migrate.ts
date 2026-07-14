import { migrate as drizzleMigrate } from 'drizzle-orm/bun-sqlite/migrator'
import { join } from 'node:path'
import type { DB } from './client.ts'
import { createDb } from './client.ts'

const MIGRATIONS = join(import.meta.dir, '..', '..', 'drizzle')

export function migrate(db: DB): void {
  drizzleMigrate(db, { migrationsFolder: MIGRATIONS })
}

// Executado direto pelo Dockerfile/entrypoint: `bun run db:migrate`
if (import.meta.main) {
  const path = process.env.DATABASE_PATH ?? './data/asaas.db'
  const { db } = createDb(path)
  migrate(db)
  console.log(`Migrações aplicadas em ${path}`)
}
