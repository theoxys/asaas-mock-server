/**
 * Track G1 — Checkout (2 operações).
 *
 * Um checkout é uma sessão de pagamento hospedada: você manda os itens e recebe
 * um link. Ele nasce ACTIVE, expira em `minutesToExpire` e pode ser cancelado.
 *
 * O cancelamento emite CHECKOUT_CANCELED — o webhook é EFEITO da transição, não
 * algo que o handler "lembra" de fazer, e por isso é emitido na mesma transação
 * que muda o status.
 */
import { and, eq } from 'drizzle-orm'
import { toBusinessTimestamp } from '../../core/clock.ts'
import { badRequest, invalid, notFound } from '../../core/errors.ts'
import { checkouts } from '../../db/schema/misc.ts'
import { checkoutId } from '../../domain/ids.ts'
import { brlToCents, cents, roundCents } from '../../domain/money.ts'
import type { HandlerMap } from '../../http/register.ts'

type CheckoutRow = typeof checkouts.$inferSelect

const BILLING_TYPES = new Set(['CREDIT_CARD', 'PIX'])
const CHARGE_TYPES = new Set(['DETACHED', 'RECURRENT', 'INSTALLMENT'])

interface CheckoutPayload {
  billingTypes: string[]
  chargeTypes: string[]
  minutesToExpire: number
  externalReference: string | null
  callback: Record<string, unknown>
  items: Record<string, unknown>[]
  customerData: Record<string, unknown> | null
  subscription: Record<string, unknown> | null
  installment: Record<string, unknown> | null
  split: Record<string, unknown>[] | null
}

function serialize(row: CheckoutRow) {
  const p = row.payload as unknown as CheckoutPayload
  return {
    id: row.id,
    link: row.link,
    status: row.status,
    billingTypes: p.billingTypes,
    chargeTypes: p.chargeTypes,
    minutesToExpire: p.minutesToExpire,
    externalReference: p.externalReference,
    callback: p.callback,
    items: p.items,
    customerData: p.customerData,
    subscription: p.subscription,
    installment: p.installment,
    split: p.split,
  }
}

/** Soma dos itens, em centavos. Aritmética inteira do começo ao fim. */
function totalCents(items: Record<string, unknown>[]) {
  let total = cents(0)
  for (const [i, item] of items.entries()) {
    const value = Number(item.value)
    const quantity = Number(item.quantity)

    if (!Number.isFinite(value) || value <= 0) {
      throw invalid('items', `O item ${i + 1} precisa de um valor maior que zero.`)
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw invalid('items', `O item ${i + 1} precisa de uma quantidade inteira positiva.`)
    }
    total = cents(total + roundCents(brlToCents(value) * quantity))
  }
  return total
}

export const checkoutHandlers: HandlerMap = {
  'create-new-checkout': async ({ ctx, auth, body }) => {
    const b = (body ?? {}) as Record<string, any>

    // billingTypes/chargeTypes são LISTAS: um checkout pode aceitar Pix e cartão,
    // e ser avulso ou parcelado, na mesma sessão.
    const billingTypes = (Array.isArray(b.billingTypes) ? b.billingTypes : []).map(String)
    const chargeTypes = (Array.isArray(b.chargeTypes) ? b.chargeTypes : []).map(String)

    if (billingTypes.length === 0 || billingTypes.some((t) => !BILLING_TYPES.has(t))) {
      throw invalid('billingTypes', 'A forma de pagamento deve ser CREDIT_CARD ou PIX.')
    }
    if (chargeTypes.length === 0 || chargeTypes.some((t) => !CHARGE_TYPES.has(t))) {
      throw invalid(
        'chargeTypes',
        'O tipo de cobrança deve ser DETACHED, RECURRENT ou INSTALLMENT.',
      )
    }

    const items = Array.isArray(b.items) ? (b.items as Record<string, unknown>[]) : []
    if (items.length === 0) {
      throw invalid('items', 'É obrigatório informar ao menos um item no checkout.')
    }

    const callback = b.callback as Record<string, unknown> | undefined
    if (!callback?.successUrl || !callback?.cancelUrl) {
      throw invalid('callback', 'As URLs de sucesso e de cancelamento são obrigatórias.')
    }

    // Regras que a spec descreve em prosa, no texto dos próprios campos.
    if (chargeTypes.includes('RECURRENT') && !b.subscription) {
      throw invalid(
        'subscription',
        'Os dados da assinatura são obrigatórios quando o tipo de cobrança é RECURRENT.',
      )
    }
    if (chargeTypes.includes('INSTALLMENT') && !b.installment) {
      throw invalid(
        'installment',
        'Os dados do parcelamento são obrigatórios quando o tipo de cobrança é INSTALLMENT.',
      )
    }

    const value = totalCents(items)

    const minutesToExpire =
      b.minutesToExpire === undefined || b.minutesToExpire === null
        ? ctx.config.rules.checkoutMinutesToExpire
        : Number(b.minutesToExpire)

    if (!Number.isInteger(minutesToExpire) || minutesToExpire <= 0) {
      throw invalid('minutesToExpire', 'O tempo de expiração deve ser um inteiro positivo.')
    }

    const id = checkoutId(ctx.rng)
    const payload: CheckoutPayload = {
      billingTypes,
      chargeTypes,
      minutesToExpire,
      externalReference: (b.externalReference as string | null) ?? null,
      callback: callback as Record<string, unknown>,
      items,
      customerData: (b.customerData as Record<string, unknown> | null) ?? null,
      subscription: (b.subscription as Record<string, unknown> | null) ?? null,
      installment: (b.installment as Record<string, unknown> | null) ?? null,
      // O request chama de `splits`, a resposta de `split`. É assim na spec.
      split: (b.splits as Record<string, unknown>[] | null) ?? null,
    }

    // Relógio virtual: a expiração é calculada no tempo SIMULADO.
    const expiresAt = new Date(ctx.clock.nowMs() + minutesToExpire * 60_000)

    const row = {
      id,
      accountId: auth.accountId,
      status: 'ACTIVE',
      valueCents: value,
      link: `${ctx.config.publicBaseUrl}/checkoutSession/show/${id}`,
      expirationDate: toBusinessTimestamp(expiresAt),
      payload: payload as unknown as Record<string, unknown>,
      dateCreated: ctx.clock.timestamp(),
    }

    await ctx.db.insert(checkouts).values(row)
    await ctx.emit(ctx.db, {
      accountId: auth.accountId,
      event: 'CHECKOUT_CREATED',
      resourceType: 'checkout',
      resourceId: id,
      resource: serialize(row as CheckoutRow),
    })

    return serialize(row as CheckoutRow) // 200, nunca 201
  },

  'cancel-a-checkout': async ({ ctx, auth, params }) => {
    const id = params.id!

    const [row] = await ctx.db
      .select()
      .from(checkouts)
      .where(and(eq(checkouts.id, id), eq(checkouts.accountId, auth.accountId)))
      .limit(1)

    if (!row) throw notFound('Checkout')

    if (row.status !== 'ACTIVE') {
      throw badRequest(
        'invalid_action',
        `Não é possível cancelar um checkout com status ${row.status}.`,
      )
    }

    // Compare-and-swap: dois cancelamentos concorrentes, um só efeito.
    await ctx.db
      .update(checkouts)
      .set({ status: 'CANCELED' })
      .where(and(eq(checkouts.id, id), eq(checkouts.status, 'ACTIVE')))

    const canceled = { ...row, status: 'CANCELED' }

    await ctx.emit(ctx.db, {
      accountId: auth.accountId,
      event: 'CHECKOUT_CANCELED',
      resourceType: 'checkout',
      resourceId: id,
      resource: serialize(canceled),
    })

    return serialize(canceled)
  },
}
