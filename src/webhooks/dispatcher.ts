/**
 * O motor de entrega. É a razão de ser do projeto.
 *
 * Roda como ÚLTIMO job do tick (ver src/scheduler/jobs/index.ts): quando ele
 * entra, tudo que aconteceu no tick já está na fila, e os eventos saem juntos e
 * na ordem em que aconteceram.
 *
 * As regras aqui são as regras REAIS do Asaas, e duas delas são contraintuitivas
 * o bastante para queimar integração em produção — por isso o simulador as
 * reproduz em vez de ser "gentil":
 *
 *   1. SÓ HTTP 200 É SUCESSO. 201, 204, 3xx, 4xx, 5xx: tudo é FALHA e entra no
 *      backoff. Um endpoint que devolve `res.sendStatus(201)` parece funcionar
 *      no seu teste e reentrega 15 vezes no Asaas de verdade.
 *
 *   2. SEQUENTIALLY faz HEAD-OF-LINE BLOCKING DE VERDADE. Se a entrega de menor
 *      `sequence` falha, NADA daquele webhook anda até ela ser entregue ou
 *      esgotar as 15 tentativas. É contrato do Asaas — e é o cenário em que o
 *      dev descobre, tarde demais, que um bug numa rota travou a fila inteira.
 */
import { and, asc, eq, gt, lte } from 'drizzle-orm'
import type { AppContext } from '../core/context.ts'
import { webhookDeliveries, webhookEvents, webhooks } from '../db/schema/index.ts'
import type { TickReport } from '../scheduler/scheduler.ts'
import { nextAttemptAt } from './backoff.ts'
import { rewriteForContainer } from './rewrite.ts'

/** NON_SEQUENTIALLY entrega em paralelo — mas não sem limite. */
const CONCURRENCY = 8

interface DueDelivery {
  id: string
  attempt: number
  sequence: number
  nextAttemptAtMs: number | null
  expiresAtMs: number
  event: string
  payload: Record<string, unknown>
}

type WebhookRow = typeof webhooks.$inferSelect

const dueColumns = {
  id: webhookDeliveries.id,
  attempt: webhookDeliveries.attempt,
  sequence: webhookDeliveries.sequence,
  nextAttemptAtMs: webhookDeliveries.nextAttemptAtMs,
  expiresAtMs: webhookDeliveries.expiresAtMs,
  event: webhookEvents.event,
  payload: webhookEvents.payload,
}

/**
 * Entrega tudo que venceu.
 *
 * `paused` vem do scheduler (POST /_admin/webhooks/pause). Pausar é necessário
 * para viajar no tempo por outro motivo: um advance de 40 dias, com o dispatcher
 * ligado e um endpoint fora do ar, esgotaria as 15 tentativas de backoff e
 * marcaria o webhook como `interrupted` — de brinde, sem ninguém pedir.
 */
export async function dispatchDue(
  ctx: AppContext,
  report: TickReport,
  paused = false,
): Promise<void> {
  if (paused) return

  const now = ctx.clock.nowMs()

  const configs = await ctx.db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.enabled, true), eq(webhooks.interrupted, false)))

  for (const cfg of configs) {
    if (cfg.sendType === 'SEQUENTIALLY') {
      await dispatchSequentially(ctx, report, cfg, now)
    } else {
      await dispatchConcurrently(ctx, report, cfg, now)
    }
  }
}

/**
 * Uma entrega por vez, em ordem estrita de `sequence`, e PARA na primeira que
 * falhar. É o head-of-line blocking do Asaas.
 *
 * O laço drena a fila enquanto der certo: três eventos emitidos no mesmo tick,
 * com o endpoint no ar, chegam os três — em ordem. Basta o primeiro falhar e os
 * outros dois ficam onde estão, mesmo já vencidos.
 */
async function dispatchSequentially(
  ctx: AppContext,
  report: TickReport,
  cfg: WebhookRow,
  now: number,
): Promise<void> {
  const seen = new Set<string>()

  for (;;) {
    const [head] = await ctx.db
      .select(dueColumns)
      .from(webhookDeliveries)
      .innerJoin(webhookEvents, eq(webhookDeliveries.eventId, webhookEvents.id))
      .where(
        and(
          eq(webhookDeliveries.webhookId, cfg.id),
          eq(webhookDeliveries.status, 'PENDING'),
        ),
      )
      .orderBy(asc(webhookDeliveries.sequence))
      .limit(1)

    if (!head) return
    // A cabeça da fila ainda está em backoff → a fila INTEIRA espera com ela.
    if (head.nextAttemptAtMs === null || head.nextAttemptAtMs > now) return
    // Passou da retenção: o retention-purge (job seguinte) marca EXPIRED.
    if (head.expiresAtMs <= now) return
    // Cinto de segurança: se um CAS não pegar, não giramos para sempre.
    if (seen.has(head.id)) return
    seen.add(head.id)

    const delivered = await attemptDelivery(ctx, report, cfg, head as DueDelivery, now)
    if (!delivered) return // head-of-line blocking: a fila trava aqui.
  }
}

/** Todas as vencidas, em paralelo, com concorrência limitada. */
async function dispatchConcurrently(
  ctx: AppContext,
  report: TickReport,
  cfg: WebhookRow,
  now: number,
): Promise<void> {
  const due = (await ctx.db
    .select(dueColumns)
    .from(webhookDeliveries)
    .innerJoin(webhookEvents, eq(webhookDeliveries.eventId, webhookEvents.id))
    .where(
      and(
        eq(webhookDeliveries.webhookId, cfg.id),
        eq(webhookDeliveries.status, 'PENDING'),
        lte(webhookDeliveries.nextAttemptAtMs, now),
        gt(webhookDeliveries.expiresAtMs, now),
      ),
    )
    .orderBy(asc(webhookDeliveries.sequence))) as DueDelivery[]

  let cursor = 0
  const worker = async (): Promise<void> => {
    while (cursor < due.length) {
      const delivery = due[cursor++]!
      await attemptDelivery(ctx, report, cfg, delivery, now)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, due.length) }, () => worker()),
  )
}

/**
 * Uma tentativa. Devolve `true` só se o endpoint respondeu HTTP 200.
 *
 * O corpo enviado é `webhook_events.payload` — CONGELADO no emit. Não
 * re-serializamos o recurso: uma retentativa três horas depois reenvia o fato
 * como ele era, não uma consulta ao estado atual.
 */
async function attemptDelivery(
  ctx: AppContext,
  report: TickReport,
  cfg: WebhookRow,
  delivery: DueDelivery,
  now: number,
): Promise<boolean> {
  const { config, clock, db } = ctx
  const url = rewriteForContainer(cfg.url, config.webhook.localhostRewrite, ctx.log)

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  // O Asaas só manda o header se o webhook tem token configurado.
  if (cfg.authToken) headers['asaas-access-token'] = cfg.authToken

  let statusCode: number | null = null
  let error: string | null = null

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(delivery.payload),
      signal: AbortSignal.timeout(config.webhook.timeoutMs),
    })
    statusCode = res.status
    await res.text().catch(() => undefined) // drena o corpo, libera o socket

    // AQUI. Só 200. 201 e 204 são falha — é a regra real, e é a que queima.
    if (statusCode !== 200) {
      error = `HTTP ${statusCode}: o Asaas só considera entregue com HTTP 200.`
    }
  } catch (err) {
    const e = err as { name?: string; message?: string }
    error =
      e?.name === 'TimeoutError' || e?.name === 'AbortError'
        ? `Timeout após ${config.webhook.timeoutMs}ms.`
        : `${e?.name ?? 'Error'}: ${e?.message ?? String(err)}`
  }

  const attempt = delivery.attempt + 1
  const timestamp = clock.timestamp()

  // Compare-and-swap: a atualização só pega se a entrega continua PENDING e no
  // mesmo número de tentativas. Uma execução duplicada do job altera zero linhas.
  const cas = and(
    eq(webhookDeliveries.id, delivery.id),
    eq(webhookDeliveries.status, 'PENDING'),
    eq(webhookDeliveries.attempt, delivery.attempt),
  )

  if (error === null) {
    await db
      .update(webhookDeliveries)
      .set({
        status: 'DELIVERED',
        attempt,
        nextAttemptAtMs: null,
        lastStatusCode: statusCode,
        lastError: null,
        lastAttemptAt: timestamp,
      })
      .where(cas)

    report.webhooks.delivered.push({
      deliveryId: delivery.id,
      event: delivery.event,
      statusCode: statusCode as number,
    })
    return true
  }

  const next = nextAttemptAt(attempt, now, config.webhook.maxAttempts)
  const exhausted = next === null

  await db
    .update(webhookDeliveries)
    .set({
      status: exhausted ? 'INTERRUPTED' : 'PENDING',
      attempt,
      nextAttemptAtMs: next,
      lastStatusCode: statusCode,
      lastError: error,
      lastAttemptAt: timestamp,
    })
    .where(cas)

  if (exhausted) {
    // Esgotou: a fila INTEIRA deste webhook congela até um removeBackoff.
    await db
      .update(webhooks)
      .set({ interrupted: true })
      .where(and(eq(webhooks.id, cfg.id), eq(webhooks.interrupted, false)))

    ctx.log(
      'warn',
      `Webhook "${cfg.name}" interrompido após ${attempt} tentativas sem HTTP 200. ` +
        `A fila está congelada — chame POST /v3/webhooks/${cfg.id}/removeBackoff.`,
      { webhookId: cfg.id, url: cfg.url, lastError: error },
    )
  }

  report.webhooks.failed.push({
    deliveryId: delivery.id,
    event: delivery.event,
    error,
    attempt,
  })
  return false
}
