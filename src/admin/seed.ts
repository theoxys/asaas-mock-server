/**
 * Seed idempotente: garante que existe uma conta principal com a API key do
 * ambiente. Roda em todo boot; se a conta já existe, não faz nada.
 */
import { eq } from 'drizzle-orm'
import { toBusinessTimestamp } from '../core/clock.ts'
import type { Clock } from '../core/clock.ts'
import type { Config } from '../core/config.ts'
import type { Rng } from '../core/rng.ts'
import type { DB } from '../db/client.ts'
import { accountDocumentGroups, accounts, apiKeys } from '../db/schema/index.ts'
import { personTypeOf } from '../domain/cpf-cnpj.ts'
import * as ids from '../domain/ids.ts'
import { createAccountDocuments } from '../modules/account-documents/service.ts'

export interface SeedResult {
  created: boolean
  accountId: string
  walletId: string
  apiKey: string
}

export async function seedMasterAccount(
  db: DB,
  config: Config,
  clock: Clock,
  rng: Rng,
): Promise<SeedResult> {
  const existing = await db.select().from(accounts).limit(1)
  if (existing.length > 0) {
    const account = existing[0]!
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.accountId, account.id))
      .limit(1)

    // Banco criado antes da tabela de documentos: sem este backfill, a conta
    // principal apareceria com o KYC pendente depois de um simples restart.
    const [group] = await db
      .select({ id: accountDocumentGroups.id })
      .from(accountDocumentGroups)
      .where(eq(accountDocumentGroups.accountId, account.id))
      .limit(1)

    if (!group) {
      await createAccountDocuments(db, { clock, rng, config }, {
        accountId: account.id,
        name: account.name,
        personType: account.personType,
        companyType: account.companyType,
        approved: true,
      })
    }

    return {
      created: false,
      accountId: account.id,
      walletId: account.walletId,
      apiKey: key?.key ?? '(nenhuma)',
    }
  }

  const now = clock.timestamp()
  const accountId = ids.accountId(rng)
  const walletId = ids.walletId(rng)
  // Se o usuário não definiu ASAAS_API_KEY, geramos uma e imprimimos no boot.
  const key = config.seedAccount.apiKey ?? ids.apiKey(rng)

  await db.insert(accounts).values({
    id: accountId,
    walletId,
    parentAccountId: null,
    name: config.seedAccount.name,
    email: config.seedAccount.email,
    loginEmail: config.seedAccount.email,
    cpfCnpj: config.seedAccount.cpfCnpj,
    personType: personTypeOf(config.seedAccount.cpfCnpj),
    country: 'Brasil',
    status: 'APPROVED', // sandbox aprova sozinho
    balanceCents: config.seedAccount.balanceCents,
    dateCreated: now,
  })

  await db.insert(apiKeys).values({
    id: ids.genericId(rng),
    accountId,
    key,
    name: 'Chave principal',
    active: true,
    dateCreated: now,
  })

  // A conta principal já vem com o KYC aprovado — é o que o sandbox real devolve
  // para uma conta em uso. A subconta é que nasce com documento a enviar.
  await createAccountDocuments(db, { clock, rng, config }, {
    accountId,
    name: config.seedAccount.name,
    personType: personTypeOf(config.seedAccount.cpfCnpj),
    companyType: null,
    approved: true,
  })

  return { created: true, accountId, walletId, apiKey: key }
}

export { toBusinessTimestamp }
