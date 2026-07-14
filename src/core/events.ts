/**
 * Emissão de eventos de webhook.
 *
 * Um evento de domínio → uma linha em `webhook_events` → N linhas em
 * `webhook_deliveries` (uma por webhook inscrito e habilitado da conta).
 *
 * O PAYLOAD É CONGELADO AQUI, no momento em que o fato aconteceu. Uma
 * retentativa três horas depois reenvia este payload, não o estado atual do
 * recurso — o evento descreve um instante, não uma consulta.
 *
 * A ENTREGA não acontece aqui. O dispatcher roda no scheduler (último job do
 * tick), o que mantém a emissão barata e dentro da transação de negócio.
 */
import { and, eq, sql } from 'drizzle-orm'
import type { DB } from '../db/client.ts'
import { webhookDeliveries, webhookEvents, webhooks } from '../db/schema/index.ts'
import { webhookEventId } from '../domain/ids.ts'
import type { Clock } from './clock.ts'
import { DAY_MS } from './clock.ts'
import type { Config } from './config.ts'
import type { Rng } from './rng.ts'

/** O recurso que acompanha o evento no payload. */
export type ResourceType =
  | 'payment'
  | 'subscription'
  | 'invoice'
  | 'transfer'
  | 'bill'
  | 'anticipation'
  | 'mobilePhoneRecharge'
  | 'accountStatus'
  | 'checkout'
  | 'balance'
  | 'internalTransferData'

export interface DomainEvent {
  accountId: string
  /** PAYMENT_RECEIVED, SUBSCRIPTION_CREATED, … (um dos 111 eventos). */
  event: string
  resourceType: ResourceType
  resourceId: string
  /** O recurso SERIALIZADO no formato de resposta da API. Congelado agora. */
  resource: Record<string, unknown>
}

export interface EmitDeps {
  clock: Clock
  rng: Rng
  config: Config
}

async function nextSequence(tx: DB, name: string): Promise<number> {
  const rows = await tx.all<{ value: number }>(sql`
    INSERT INTO sequences (name, value) VALUES (${name}, 1)
    ON CONFLICT(name) DO UPDATE SET value = value + 1
    RETURNING value
  `)
  return rows[0]!.value
}

export function createEmitter(deps: EmitDeps) {
  return async function emit(tx: DB, event: DomainEvent): Promise<void> {
    const seq = await nextSequence(tx, 'webhook_event')
    const id = webhookEventId(deps.rng, seq)
    const nowMs = deps.clock.nowMs()
    const timestamp = deps.clock.timestamp()

    /**
     * O envelope exato do Asaas. A chave do recurso varia com o tipo do evento
     * (`payment`, `subscription`, `transfer`…), e é isso que o cliente lê.
     */
    const payload = {
      id,
      event: event.event,
      dateCreated: timestamp,
      account: { id: event.accountId, ownerId: null },
      [event.resourceType]: event.resource,
    }

    await tx.insert(webhookEvents).values({
      id,
      accountId: event.accountId,
      event: event.event,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      payload,
      dateCreated: timestamp,
      createdAtMs: nowMs,
    })

    // Fan-out: só webhooks habilitados desta conta que assinaram este evento.
    const configs = await tx
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.accountId, event.accountId), eq(webhooks.enabled, true)))

    const expiresAtMs = nowMs + deps.config.webhook.retentionDays * DAY_MS

    for (const cfg of configs) {
      if (!cfg.events.includes(event.event)) continue

      // Ordem estrita por webhook. É o que dá sentido ao modo SEQUENTIALLY.
      const sequence = await nextSequence(tx, `webhook_delivery:${cfg.id}`)

      await tx.insert(webhookDeliveries).values({
        id: deps.rng.uuid(),
        webhookId: cfg.id,
        eventId: id,
        accountId: event.accountId,
        sequence,
        status: 'PENDING',
        attempt: 0,
        // Primeira tentativa é imediata (offset 0 da tabela de backoff).
        nextAttemptAtMs: nowMs,
        expiresAtMs,
        dateCreated: timestamp,
      })
    }
  }
}
