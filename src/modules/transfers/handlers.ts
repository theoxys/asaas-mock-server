import { and, count, eq, gte, lte } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import { accounts, transfers } from '../../db/schema/index.ts'
import type { HandlerMap } from '../../http/register.ts'
import { serializeInternalTransfer, serializeTransfer, type TransferRow } from './serializer.ts'
import { cancelTransfer, createTransfer, parseTransferBody } from './service.ts'

async function findOwned(
  ctx: AppContext,
  auth: AuthContext,
  id: string,
): Promise<TransferRow> {
  const [row] = await ctx.db
    .select()
    .from(transfers)
    .where(and(eq(transfers.id, id), eq(transfers.accountId, auth.accountId)))
    .limit(1)
  // Transferência de outra conta não é 403: é 404. Ela simplesmente não existe
  // para quem perguntou.
  if (!row) throw notFound('Transferência')
  return row as TransferRow
}

/** A resposta da interna carrega os dados da conta de destino. */
async function serialize(ctx: AppContext, t: TransferRow): Promise<Record<string, unknown>> {
  if (t.operationType !== 'INTERNAL' || !t.destinationAccountId) return serializeTransfer(t)

  const [dest] = await ctx.db
    .select()
    .from(accounts)
    .where(eq(accounts.id, t.destinationAccountId))
    .limit(1)

  if (!dest) return serializeTransfer(t)
  return serializeInternalTransfer(t, {
    name: dest.name,
    cpfCnpj: dest.cpfCnpj,
    accountNumber: dest.accountNumber,
  })
}

export const transferHandlers: HandlerMap = {
  /**
   * Atende TAMBÉM `transfer-to-asaas-account`: na spec do Asaas as duas
   * operações dividem POST /v3/transfers (a variante está marcada com
   * `variantOf` no manifesto) e o BODY decide qual é. `walletId` presente →
   * transferência interna entre contas Asaas; senão, banco externo ou chave Pix.
   */
  'transfer-to-another-institution-account-or-pix-key': async ({ ctx, auth, body }) => {
    const input = parseTransferBody(body, ctx.clock.today())
    const { body: out } = await createTransfer(ctx, auth, input)
    return out // 200, nunca 201
  },

  'list-transfers': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const filters = [eq(transfers.accountId, auth.accountId)]

    if (query.type) {
      const t = String(query.type)
      // `type` na resposta é a operação (PIX/TED/INTERNAL); na coluna é o destino
      // (BANK_ACCOUNT/PIX/INTERNAL). Aceitamos os dois vocabulários no filtro.
      filters.push(
        t === 'BANK_ACCOUNT' ? eq(transfers.type, t) : eq(transfers.operationType, t),
      )
    }
    if (query['dateCreated[ge]']) {
      filters.push(gte(transfers.dateCreated, String(query['dateCreated[ge]'])))
    }
    if (query['dateCreated[le]']) {
      filters.push(lte(transfers.dateCreated, String(query['dateCreated[le]'])))
    }
    // `transferDate` é a data em que o dinheiro de fato saiu → effectiveDate.
    if (query['transferDate[ge]']) {
      filters.push(gte(transfers.effectiveDate, String(query['transferDate[ge]'])))
    }
    if (query['transferDate[le]']) {
      filters.push(lte(transfers.effectiveDate, String(query['transferDate[le]'])))
    }

    const where = and(...filters)

    const [total] = await ctx.db.select({ n: count() }).from(transfers).where(where)
    const rows = await ctx.db.select().from(transfers).where(where).limit(limit).offset(offset)

    const data = await Promise.all(rows.map((r) => serialize(ctx, r as TransferRow)))
    return listEnvelope(data, total?.n ?? 0, limit, offset)
  },

  'retrieve-a-single-transfer': async ({ ctx, auth, params }) =>
    serialize(ctx, await findOwned(ctx, auth, params.id!)),

  'cancel-a-transfer': async ({ ctx, auth, params }) => {
    await findOwned(ctx, auth, params.id!) // 404 antes de 400
    return cancelTransfer(ctx, auth, params.id!)
  },
}
