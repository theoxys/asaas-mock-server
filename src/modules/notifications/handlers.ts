/**
 * Track G1 — Notification (2 operações).
 *
 * As notificações NÃO são criadas por este módulo: elas nascem junto com o
 * cliente (uma por evento notificável) e só podem ser ATUALIZADAS. É por isso que
 * a tag só tem PUT.
 *
 * `notifications` não tem `account_id` — a dona é a conta do CLIENTE. Todo acesso
 * passa por um join com `customers`, senão o isolamento entre contas vazaria pelo
 * id da notificação, que é adivinhável.
 */
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { AppContext } from '../../core/context.ts'
import { invalid, notFound } from '../../core/errors.ts'
import { customers } from '../../db/schema/customers.ts'
import { notifications } from '../../db/schema/misc.ts'
import type { HandlerMap } from '../../http/register.ts'

type NotificationRow = typeof notifications.$inferSelect

const SCHEDULE_OFFSETS = new Set([0, 1, 5, 7, 10, 15, 30])

const BOOLEAN_FIELDS = [
  'enabled',
  'emailEnabledForProvider',
  'smsEnabledForProvider',
  'emailEnabledForCustomer',
  'smsEnabledForCustomer',
  'phoneCallEnabledForCustomer',
  'whatsappEnabledForCustomer',
] as const

function serialize(row: NotificationRow, customerId: string) {
  return {
    object: 'notification',
    id: row.id,
    customer: customerId,
    enabled: row.enabled,
    emailEnabledForProvider: row.emailEnabledForProvider,
    smsEnabledForProvider: row.smsEnabledForProvider,
    emailEnabledForCustomer: row.emailEnabledForCustomer,
    smsEnabledForCustomer: row.smsEnabledForCustomer,
    phoneCallEnabledForCustomer: row.phoneCallEnabledForCustomer,
    whatsappEnabledForCustomer: row.whatsappEnabledForCustomer,
    event: row.event,
    scheduleOffset: row.scheduleOffset,
    deleted: row.deleted,
  }
}

/** Extrai o patch do body, validando o que o TypeBox não valida. */
function buildPatch(body: Record<string, unknown>): Partial<NotificationRow> {
  const patch: Partial<NotificationRow> = {}

  for (const field of BOOLEAN_FIELDS) {
    const v = body[field]
    if (v === undefined || v === null) continue
    if (typeof v !== 'boolean') throw invalid(field, `O campo ${field} deve ser booleano.`)
    ;(patch as Record<string, unknown>)[field] = v
  }

  if (body.scheduleOffset !== undefined && body.scheduleOffset !== null) {
    const offset = Number(body.scheduleOffset)
    if (!SCHEDULE_OFFSETS.has(offset)) {
      throw invalid(
        'scheduleOffset',
        'O agendamento deve ser um destes valores: 0, 1, 5, 7, 10, 15 ou 30.',
      )
    }
    patch.scheduleOffset = offset
  }

  return patch
}

/**
 * A notificação existe E pertence a um cliente DESTA conta. As duas coisas na
 * mesma consulta — a segunda é o isolamento.
 */
async function loadNotification(
  ctx: AppContext,
  accountId: string,
  id: string,
): Promise<{ notification: NotificationRow; customerId: string }> {
  const [row] = await ctx.db
    .select({ notification: notifications, customerId: customers.id })
    .from(notifications)
    .innerJoin(customers, eq(notifications.customerId, customers.id))
    .where(and(eq(notifications.id, id), eq(customers.accountId, accountId)))
    .limit(1)

  if (!row) throw notFound('Notificação')
  return row
}

async function customerNotifications(
  ctx: AppContext,
  customerId: string,
): Promise<NotificationRow[]> {
  return ctx.db
    .select()
    .from(notifications)
    .where(eq(notifications.customerId, customerId))
    .orderBy(asc(notifications.id))
}

export const notificationHandlers: HandlerMap = {
  'update-existing-notification': async ({ ctx, auth, params, body }) => {
    const { notification, customerId } = await loadNotification(
      ctx,
      auth.accountId,
      params.id!,
    )
    const patch = buildPatch((body ?? {}) as Record<string, unknown>)

    if (Object.keys(patch).length > 0) {
      await ctx.db.update(notifications).set(patch).where(eq(notifications.id, notification.id))
    }

    return serialize({ ...notification, ...patch }, customerId)
  },

  'update-existing-notifications-in-batch': async ({ ctx, auth, body }) => {
    const b = (body ?? {}) as { customer?: string; notifications?: unknown[] }

    if (!b.customer) {
      throw invalid('customer', 'O cliente é obrigatório.')
    }

    // O cliente precisa ser DESTA conta — o id de cliente é adivinhável.
    const [customer] = await ctx.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, b.customer), eq(customers.accountId, auth.accountId)))
      .limit(1)

    if (!customer) throw notFound('Cliente')

    const items = (b.notifications ?? []) as Record<string, unknown>[]
    const ids = items.map((n) => String(n.id ?? ''))

    if (ids.some((id) => id === '')) {
      throw invalid('id', 'Toda notificação do lote precisa de um id.')
    }

    if (ids.length > 0) {
      // Todas as notificações do lote têm que ser DESTE cliente. Um lote parcial
      // aplicado pela metade é pior que um lote recusado.
      const owned = await ctx.db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(inArray(notifications.id, ids), eq(notifications.customerId, customer.id)),
        )

      const ownedIds = new Set(owned.map((n) => n.id))
      const alien = ids.find((id) => !ownedIds.has(id))
      if (alien) throw notFound(`Notificação ${alien}`)

      for (const item of items) {
        const patch = buildPatch(item)
        if (Object.keys(patch).length === 0) continue
        await ctx.db
          .update(notifications)
          .set(patch)
          .where(eq(notifications.id, String(item.id)))
      }
    }

    const rows = await customerNotifications(ctx, customer.id)
    return { notifications: rows.map((r) => serialize(r, customer.id)) }
  },
}
