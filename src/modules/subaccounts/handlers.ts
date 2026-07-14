/**
 * Subcontas. (Track F)
 *
 * POR QUE ISTO IMPORTA MAIS DO QUE PARECE: uma subconta nasce com **API key
 * própria** e **walletId próprio**. É o que torna o split testável de verdade —
 * o dinheiro sai de uma conta, entra na outra, e os DOIS extratos fecham. Sem
 * subconta, o walletId de destino seria uma string sem dono e o split não
 * passaria de uma anotação.
 *
 * A chave é mostrada UMA ÚNICA VEZ, na resposta da criação (e na criação de uma
 * nova chave). Depois disso ela não volta mais em lugar nenhum — é o que o Asaas
 * faz, e um mock que devolvesse a chave numa listagem ensinaria o integrador a
 * confiar em algo que a API real nunca vai entregar.
 */
import { and, count, eq } from 'drizzle-orm'
import type { AppContext } from '../../core/context.ts'
import { invalid, notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import { accounts, apiKeys, webhooks } from '../../db/schema/index.ts'
import type { DB } from '../../db/client.ts'
import { isValidCpfCnpj, personTypeOf } from '../../domain/cpf-cnpj.ts'
import * as ids from '../../domain/ids.ts'
import { brlToCents } from '../../domain/money.ts'
import type { HandlerMap } from '../../http/register.ts'
import { createAccountDocuments } from '../account-documents/service.ts'

type AccountRow = typeof accounts.$inferSelect
type ApiKeyRow = typeof apiKeys.$inferSelect

const digitsOnly = (v: string): string => v.replace(/\D/g, '')

/**
 * A subconta só existe para quem a criou. Para qualquer outra conta ela é um
 * 404 — não um 403: a API não confirma nem desmente a existência de uma conta
 * alheia.
 */
async function findSubaccount(
  ctx: AppContext,
  parentAccountId: string,
  id: string,
): Promise<AccountRow> {
  const [row] = await ctx.db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.parentAccountId, parentAccountId)))
    .limit(1)

  if (!row) throw notFound('Subconta')
  return row
}

/** `"235104-7"` → `{ agency: '0001', account: '235104', accountDigit: '7' }` */
function serializeAccountNumber(stored: string | null): Record<string, unknown> | null {
  if (!stored) return null
  const [number, digit] = stored.split('-')
  return { agency: '0001', account: number ?? stored, accountDigit: digit ?? '0' }
}

function serializeAccount(a: AccountRow): Record<string, unknown> {
  return {
    object: 'account',
    id: a.id,
    name: a.name,
    email: a.email,
    loginEmail: a.loginEmail,
    phone: a.phone,
    mobilePhone: a.mobilePhone,
    address: a.address,
    addressNumber: a.addressNumber,
    complement: a.complement,
    province: a.province,
    postalCode: a.postalCode,
    cpfCnpj: a.cpfCnpj,
    birthDate: a.birthDate,
    personType: a.personType,
    companyType: a.companyType,
    /**
     * TODO(regra): `city` é o id numérico da cidade no cadastro do Asaas, e não
     * existe tabela pública desse cadastro. O request de criação nem sequer tem
     * o campo — devolvemos null em vez de inventar um número que ninguém
     * conseguiria conferir.
     */
    city: null,
    state: a.state,
    country: a.country,
    tradingName: a.tradingName,
    site: a.site,
    walletId: a.walletId,
    accountNumber: serializeAccountNumber(a.accountNumber),
    commercialInfoExpiration: { isExpired: false, scheduledDate: null },
  }
}

/**
 * A chave de API SEM o segredo. É o que sai numa listagem.
 * `projectedExpirationDateByLackOfUse`: TODO(regra) — a doc não define a janela
 * de inatividade que expira uma chave; devolvemos null em vez de chutar.
 */
function serializeApiKey(k: ApiKeyRow): Record<string, unknown> {
  return {
    id: k.id,
    name: k.name,
    enabled: k.active,
    disabledReason: k.active ? null : 'MANUAL',
    expirationDate: k.expirationDate,
    dateCreated: k.dateCreated,
    projectedExpirationDateByLackOfUse: null,
  }
}

export const subaccountHandlers: HandlerMap = {
  /**
   * Cria a subconta COM chave de API própria. É a única vez que a chave aparece.
   *
   * O cadastro nasce APPROVED (a subconta já transaciona), mas o KYC NÃO: ela
   * nasce com um grupo de documentos pendente (`GET /v3/myAccount/documents`),
   * que é o que o cliente precisa ter para exercitar o onboarding. Quem fecha o
   * ciclo é o upload do arquivo ou `POST /v3/sandbox/myAccount/approve`.
   */
  'create-subaccount': async ({ ctx, auth, body }) => {
    const b = body as Record<string, any>

    const cpfCnpj = digitsOnly(String(b.cpfCnpj ?? ''))
    if (!isValidCpfCnpj(cpfCnpj)) {
      throw invalid('cpfCnpj', 'O CPF ou CNPJ informado é inválido.')
    }

    // O Asaas não deixa duas contas com o mesmo documento.
    const [dup] = await ctx.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.cpfCnpj, cpfCnpj))
      .limit(1)
    if (dup) {
      throw invalid('cpfCnpj', 'Já existe uma conta cadastrada com este CPF/CNPJ.')
    }

    const income = Number(b.incomeValue)
    if (!Number.isFinite(income) || income < 0) {
      throw invalid('incomeValue', 'O faturamento/renda mensal deve ser um valor positivo.')
    }

    const now = ctx.clock.timestamp()
    const accountId = ids.accountId(ctx.rng)
    const walletId = ids.walletId(ctx.rng)
    const key = ids.apiKey(ctx.rng)
    const apiKeyId = ids.genericId(ctx.rng)
    const personType = personTypeOf(cpfCnpj)

    const row: AccountRow = {
      id: accountId,
      walletId,
      parentAccountId: auth.accountId,

      name: String(b.name),
      companyName: null,
      // "Display name (auto-populated)" — o Asaas preenche sozinho.
      tradingName: String(b.name),
      email: String(b.email),
      loginEmail: b.loginEmail ? String(b.loginEmail) : String(b.email),
      cpfCnpj,
      personType,
      companyType: personType === 'JURIDICA' ? (b.companyType ?? null) : null,
      birthDate: b.birthDate ?? null,
      mobilePhone: b.mobilePhone ? String(b.mobilePhone) : null,
      phone: b.phone ?? null,
      site: b.site ?? null,

      address: String(b.address),
      addressNumber: String(b.addressNumber),
      complement: b.complement ?? null,
      province: String(b.province),
      postalCode: String(b.postalCode),
      city: null,
      state: null,
      country: 'Brasil',

      incomeCents: brlToCents(income),
      status: 'APPROVED', // o cadastro, não o KYC — os documentos nascem pendentes
      balanceCents: 0,
      accountNumber: `${ctx.rng.digits(6)}-${ctx.rng.digits(1)}`,
      dateCreated: now,
    }

    await ctx.db.transaction(async (tx) => {
      await tx.insert(accounts).values(row)
      await tx.insert(apiKeys).values({
        id: apiKeyId,
        accountId,
        key,
        name: 'Chave principal',
        active: true,
        dateCreated: now,
        expirationDate: null,
      })

      await createAccountDocuments(
        tx as unknown as DB,
        { clock: ctx.clock, rng: ctx.rng, config: ctx.config },
        {
          accountId,
          name: row.name,
          personType: row.personType,
          companyType: row.companyType,
          approved: false,
        },
      )

      // O request pode já trazer os webhooks da subconta. Ignorá-los em silêncio
      // faria o integrador achar que assinou eventos que nunca chegariam.
      for (const w of (b.webhooks ?? []) as Record<string, any>[]) {
        await tx.insert(webhooks).values({
          id: ids.webhookConfigId(ctx.rng),
          accountId,
          name: String(w.name ?? 'Webhook'),
          url: String(w.url ?? ''),
          email: String(w.email ?? b.email),
          enabled: w.enabled ?? true,
          interrupted: w.interrupted ?? false,
          authToken: w.authToken ?? null,
          apiVersion: w.apiVersion ?? 3,
          sendType: w.sendType === 'NON_SEQUENTIALLY' ? 'NON_SEQUENTIALLY' : 'SEQUENTIALLY',
          events: (w.events ?? []) as string[],
          dateCreated: now,
        })
      }
    })

    return {
      ...serializeAccount(row),
      /**
       * `apiKey` no topo E dentro de `accessToken`. A spec só declara o objeto
       * `accessToken`, mas a doc e os exemplos do Asaas mostram `apiKey` na raiz
       * — e é ali que todo integrador olha. Devolver os dois não mente sobre
       * nada e evita que alguém não ache a chave.
       */
      apiKey: key,
      accessToken: {
        id: apiKeyId,
        name: 'Chave principal',
        enabled: true,
        disabledReason: null,
        expirationDate: null,
        dateCreated: now,
        projectedExpirationDateByLackOfUse: null,
        apiKey: key,
      },
    }
  },

  'list-subaccounts': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const filters = [eq(accounts.parentAccountId, auth.accountId)]
    if (query.cpfCnpj) filters.push(eq(accounts.cpfCnpj, digitsOnly(String(query.cpfCnpj))))
    if (query.email) filters.push(eq(accounts.email, String(query.email)))
    if (query.name) filters.push(eq(accounts.name, String(query.name)))
    if (query.walletId) filters.push(eq(accounts.walletId, String(query.walletId)))

    const where = and(...filters)

    const [total] = await ctx.db.select({ n: count() }).from(accounts).where(where)
    const rows = await ctx.db
      .select()
      .from(accounts)
      .where(where)
      .limit(limit)
      .offset(offset)

    return listEnvelope(rows.map(serializeAccount), total?.n ?? 0, limit, offset)
  },

  'retrieve-a-single-subaccount': async ({ ctx, auth, params }) =>
    serializeAccount(await findSubaccount(ctx, auth.accountId, params.id!)),

  /**
   * Encerra a subconta. As chaves dela param de funcionar na hora (401 na próxima
   * requisição) — é o efeito que importa, e o que um teste consegue observar.
   */
  'close-non-baas-subaccount': async ({ ctx, auth, params }) => {
    const sub = await findSubaccount(ctx, auth.accountId, params.id!)

    await ctx.db.transaction(async (tx) => {
      await tx.update(accounts).set({ status: 'CLOSED' }).where(eq(accounts.id, sub.id))
      await tx.update(apiKeys).set({ active: false }).where(eq(apiKeys.accountId, sub.id))
    })

    return { deleted: true, id: sub.id }
  },

  /**
   * Reenvia o link de ativação. Aqui não há e-mail para enviar — o que existe é
   * a garantia de que a subconta existe e é sua. 204, sem corpo.
   */
  'resend-activation-link-for-non-baas-subaccount': async ({ ctx, auth, params }) => {
    const sub = await findSubaccount(ctx, auth.accountId, params.id!)
    ctx.log('info', `Link de ativação reenviado para a subconta ${sub.id} (${sub.email})`)
    return new Response(null, { status: 204 })
  },

  // ── Chaves de API da subconta ──────────────────────────────

  'create-api-key-for-subaccount': async ({ ctx, auth, params, body }) => {
    const sub = await findSubaccount(ctx, auth.accountId, params.id!)
    const b = (body ?? {}) as Record<string, any>

    const now = ctx.clock.timestamp()
    const id = ids.genericId(ctx.rng)
    const key = ids.apiKey(ctx.rng)
    const name = b.name ? String(b.name) : 'Chave de API'
    const expirationDate = b.expirationDate ? String(b.expirationDate) : null

    await ctx.db.insert(apiKeys).values({
      id,
      accountId: sub.id,
      key,
      name,
      active: true,
      dateCreated: now,
      expirationDate,
    })

    // A ÚNICA resposta que carrega o segredo. A listagem nunca o devolve.
    return {
      id,
      name,
      enabled: true,
      disabledReason: null,
      expirationDate,
      dateCreated: now,
      projectedExpirationDateByLackOfUse: null,
      apiKey: key,
    }
  },

  'list-api-keys-for-subaccount': async ({ ctx, auth, params }) => {
    const sub = await findSubaccount(ctx, auth.accountId, params.id!)

    const rows = await ctx.db.select().from(apiKeys).where(eq(apiKeys.accountId, sub.id))
    return { accessTokens: rows.map(serializeApiKey) }
  },

  'update-api-key-for-a-subaccount': async ({ ctx, auth, params, body }) => {
    const sub = await findSubaccount(ctx, auth.accountId, params.id!)
    const b = (body ?? {}) as Record<string, any>

    const [key] = await ctx.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, params.accessTokenId!), eq(apiKeys.accountId, sub.id)))
      .limit(1)
    if (!key) throw notFound('Chave de API')

    const patch: Partial<ApiKeyRow> = {}
    if (b.name !== undefined) patch.name = String(b.name)
    // Desabilitar a chave a mata na prática: a autenticação só aceita chave ativa.
    if (b.enabled !== undefined) patch.active = Boolean(b.enabled)
    if (b.expirationDate !== undefined) patch.expirationDate = b.expirationDate ?? null

    await ctx.db.update(apiKeys).set(patch).where(eq(apiKeys.id, key.id))
    return serializeApiKey({ ...key, ...patch })
  },

  'delete-api-key-for-a-subaccount': async ({ ctx, auth, params }) => {
    const sub = await findSubaccount(ctx, auth.accountId, params.id!)

    const [key] = await ctx.db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, params.accessTokenId!), eq(apiKeys.accountId, sub.id)))
      .limit(1)
    if (!key) throw notFound('Chave de API')

    await ctx.db.delete(apiKeys).where(eq(apiKeys.id, key.id))
    return new Response(null, { status: 204 })
  },
}
