/**
 * As 6 operações da tag "Webhook" da API v3.
 *
 * O CRUD é o de sempre; o que não é trivial mora em duas regras:
 *
 *   - `interrupted` é o freio da fila. Vira `true` sozinho quando uma entrega
 *     esgota as 15 tentativas (ver src/webhooks/dispatcher.ts). Enquanto estiver
 *     `true`, NADA daquele webhook é entregue — nem os eventos novos.
 *
 *   - `removeBackoff` (e um PUT com `interrupted: false`) é o destravamento:
 *     zera o contador de tentativas, reagenda tudo para agora e solta a fila.
 *     É o botão que o dev aperta depois de consertar o endpoint dele.
 *
 * A resposta NÃO devolve o `authToken` — só `hasAuthToken`. É o que a spec diz e
 * é o que o Asaas faz: o token só sai daqui dentro do header `asaas-access-token`
 * de uma entrega.
 */
import { and, asc, count, eq, inArray } from 'drizzle-orm'
import type { AppContext } from '../../core/context.ts'
import { badRequest, invalid, notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import { webhookDeliveries, webhooks } from '../../db/schema/index.ts'
import { webhookConfigId } from '../../domain/ids.ts'
import type { HandlerMap } from '../../http/register.ts'

type WebhookRow = typeof webhooks.$inferSelect
type SendType = WebhookRow['sendType']

/** O `authToken` tem 32–255 caracteres. É a regra da spec, e ela é checável. */
const AUTH_TOKEN_MIN = 32
const AUTH_TOKEN_MAX = 255

function serialize(row: WebhookRow) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    email: row.email,
    enabled: row.enabled,
    interrupted: row.interrupted,
    apiVersion: row.apiVersion,
    hasAuthToken: row.authToken !== null && row.authToken !== '',
    sendType: row.sendType,
    /**
     * TODO(regra): a doc não define como o Asaas conta "requisição penalizada" —
     * se é a tentativa que falhou, a que foi adiada pelo backoff, ou a janela de
     * throttling da conta. Inventar um número aqui seria pior que devolver 0:
     * produziria falsa confiança num campo que ninguém consegue conferir.
     * Registrado em progress.md.
     */
    penalizedRequestsCount: 0,
    events: row.events,
  }
}

function assertAuthToken(token: unknown): string | null {
  if (token === undefined || token === null || token === '') return null
  if (typeof token !== 'string') {
    throw invalid('authToken', 'O token de autenticação deve ser um texto.')
  }
  if (token.length < AUTH_TOKEN_MIN || token.length > AUTH_TOKEN_MAX) {
    throw invalid(
      'authToken',
      `O token de autenticação deve ter entre ${AUTH_TOKEN_MIN} e ${AUTH_TOKEN_MAX} caracteres.`,
    )
  }
  return token
}

function assertUrl(url: unknown): string {
  if (typeof url !== 'string' || url.trim() === '') {
    throw invalid('url', 'A URL do webhook é obrigatória.')
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw invalid('url', `A URL do webhook é inválida: "${url}".`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw invalid('url', 'A URL do webhook deve usar http ou https.')
  }
  return url
}

function assertEvents(events: unknown): string[] {
  if (!Array.isArray(events) || events.length === 0) {
    throw invalid('events', 'Informe ao menos um evento para o webhook observar.')
  }
  return [...new Set(events as string[])]
}

async function findOwned(ctx: AppContext, accountId: string, id: string): Promise<WebhookRow> {
  const [row] = await ctx.db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.accountId, accountId)))
    .limit(1)

  if (!row) throw notFound('Webhook')
  return row
}

/**
 * Destrava a fila: as entregas que estavam esperando o backoff (ou que já haviam
 * esgotado as tentativas) voltam a PENDING, com o contador zerado e agendadas
 * para AGORA. O próximo tick as entrega.
 *
 * É o que `removeBackoff` faz, e é o que um PUT com `interrupted: false` também
 * precisa fazer — senão o webhook diria "não estou interrompido" e continuaria
 * sem entregar nada, que é a pior mentira possível aqui.
 */
async function releaseQueue(ctx: AppContext, webhookId: string): Promise<void> {
  const now = ctx.clock.nowMs()

  await ctx.db
    .update(webhookDeliveries)
    .set({ status: 'PENDING', attempt: 0, nextAttemptAtMs: now })
    .where(
      and(
        eq(webhookDeliveries.webhookId, webhookId),
        inArray(webhookDeliveries.status, ['PENDING', 'INTERRUPTED']),
      ),
    )

  await ctx.db
    .update(webhooks)
    .set({ interrupted: false })
    .where(eq(webhooks.id, webhookId))
}

export const webhookHandlers: HandlerMap = {
  /** POST /v3/webhooks — criação devolve 200, nunca 201. */
  'create-new-webhook': async ({ ctx, auth, body }) => {
    const b = body as Record<string, unknown>

    const [{ total = 0 } = {}] = await ctx.db
      .select({ total: count() })
      .from(webhooks)
      .where(eq(webhooks.accountId, auth.accountId))

    const max = ctx.config.webhook.maxPerAccount
    if (total >= max) {
      throw badRequest(
        'invalid_webhook',
        `Você atingiu o limite de ${max} webhooks por conta. ` +
          `Remova um webhook existente antes de criar outro.`,
      )
    }

    const row: WebhookRow = {
      id: webhookConfigId(ctx.rng),
      accountId: auth.accountId,
      name: String(b.name),
      url: assertUrl(b.url),
      email: String(b.email),
      enabled: b.enabled === undefined || b.enabled === null ? true : Boolean(b.enabled),
      interrupted: b.interrupted === true,
      authToken: assertAuthToken(b.authToken),
      apiVersion: b.apiVersion == null ? 3 : Number(b.apiVersion),
      sendType: (b.sendType as SendType) ?? 'SEQUENTIALLY',
      events: assertEvents(b.events),
      dateCreated: ctx.clock.timestamp(),
    }

    await ctx.db.insert(webhooks).values(row)
    return serialize(row)
  },

  /** GET /v3/webhooks */
  'list-webhooks': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const [{ total = 0 } = {}] = await ctx.db
      .select({ total: count() })
      .from(webhooks)
      .where(eq(webhooks.accountId, auth.accountId))

    const rows = await ctx.db
      .select()
      .from(webhooks)
      .where(eq(webhooks.accountId, auth.accountId))
      .orderBy(asc(webhooks.dateCreated), asc(webhooks.id))
      .limit(limit)
      .offset(offset)

    return listEnvelope(rows.map(serialize), total, limit, offset)
  },

  /** GET /v3/webhooks/{id} */
  'retrieve-a-single-webhook': async ({ ctx, auth, params }) => {
    return serialize(await findOwned(ctx, auth.accountId, params.id!))
  },

  /** PUT /v3/webhooks/{id} */
  'update-existing-webhook': async ({ ctx, auth, params, body }) => {
    const current = await findOwned(ctx, auth.accountId, params.id!)
    const b = (body ?? {}) as Record<string, unknown>

    const patch: Partial<WebhookRow> = {}
    if (b.name != null) patch.name = String(b.name)
    if (b.url != null) patch.url = assertUrl(b.url)
    if (b.sendType != null) patch.sendType = b.sendType as SendType
    if (b.enabled != null) patch.enabled = Boolean(b.enabled)
    if (b.events != null) patch.events = assertEvents(b.events)
    if ('authToken' in b) patch.authToken = assertAuthToken(b.authToken)

    // `interrupted: true` congela a fila à mão — é como o dev simula um webhook
    // travado sem precisar derrubar o próprio endpoint.
    const reactivating = b.interrupted === false && current.interrupted
    if (b.interrupted != null) patch.interrupted = Boolean(b.interrupted)

    if (Object.keys(patch).length > 0) {
      await ctx.db.update(webhooks).set(patch).where(eq(webhooks.id, current.id))
    }
    // Soltar a fila é mais do que virar o booleano: as entregas travadas
    // precisam voltar a PENDING, senão o webhook mentiria sobre estar ativo.
    if (reactivating) await releaseQueue(ctx, current.id)

    return serialize(await findOwned(ctx, auth.accountId, current.id))
  },

  /** DELETE /v3/webhooks/{id} */
  'remove-webhook': async ({ ctx, auth, params }) => {
    const row = await findOwned(ctx, auth.accountId, params.id!)

    // As entregas referenciam o webhook (FK ON): saem primeiro. O histórico de
    // um webhook removido não tem para onde apontar.
    await ctx.db.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, row.id))
    await ctx.db.delete(webhooks).where(eq(webhooks.id, row.id))

    return { deleted: true, id: row.id }
  },

  /**
   * POST /v3/webhooks/{id}/removeBackoff — 204, sem corpo.
   *
   * O endpoint que o dev chama depois de consertar a rota dele: zera o backoff,
   * reagenda a fila para agora e destrava o webhook.
   */
  'remove-webhook-backoff': async ({ ctx, auth, params }) => {
    const row = await findOwned(ctx, auth.accountId, params.id!)
    await releaseQueue(ctx, row.id)
    return new Response(null, { status: 204 })
  },
}
