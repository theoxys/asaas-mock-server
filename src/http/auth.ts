/**
 * Autenticação: header `access_token`, exatamente como o Asaas.
 *
 * Cada chave pertence a uma conta, e a conta carrega walletId e saldo próprios.
 * É isso que faz o split funcionar de verdade entre contas deste servidor.
 */
import { and, eq } from 'drizzle-orm'
import type { DB } from '../db/client.ts'
import { accounts, apiKeys } from '../db/schema/index.ts'
import type { AuthContext } from '../core/context.ts'
import { invalidTokenFormat, unauthorized } from '../core/errors.ts'

export async function authenticate(db: DB, token: string | undefined): Promise<AuthContext> {
  if (!token) throw unauthorized()

  // O Asaas distingue "formato inválido" de "chave inválida" — é o que permite
  // ao cliente saber que colou a chave errada, e não que ela expirou.
  if (!token.startsWith('$aact_')) throw invalidTokenFormat()

  const [row] = await db
    .select({
      apiKeyId: apiKeys.id,
      accountId: accounts.id,
      walletId: accounts.walletId,
    })
    .from(apiKeys)
    .innerJoin(accounts, eq(apiKeys.accountId, accounts.id))
    .where(and(eq(apiKeys.key, token), eq(apiKeys.active, true)))
    .limit(1)

  if (!row) throw unauthorized()

  return { accountId: row.accountId, walletId: row.walletId, apiKeyId: row.apiKeyId }
}
