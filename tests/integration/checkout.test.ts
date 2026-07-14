/**
 * Checkout — sessão de pagamento hospedada.
 *
 * O ponto que este teste protege: o cancelamento é uma TRANSIÇÃO, e o webhook é
 * efeito dela. Cancelar duas vezes não gera dois CHECKOUT_CANCELED.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { checkouts, webhookEvents } from '../../src/db/schema/index.ts'
import { checkoutHandlers } from '../../src/modules/checkout/handlers.ts'
import { createHarness, createSecondAccount, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeAll(async () => {
  h = await createHarness()
})
afterAll(() => h.close())

const BODY = {
  billingTypes: ['PIX'],
  chargeTypes: ['DETACHED'],
  minutesToExpire: 100,
  externalReference: 'pedido-42',
  callback: {
    successUrl: 'https://exemplo.com/sucesso',
    cancelUrl: 'https://exemplo.com/cancelado',
  },
  items: [
    { name: 'Camiseta', description: 'Preta', imageBase64: 'SU1BR0U=', quantity: 2, value: 100 },
  ],
}

const newCheckout = async (over: Record<string, unknown> = {}) => {
  const { status, body } = await h.api.call('create-new-checkout', {
    body: { ...BODY, ...over },
  })
  expect(status).toBe(200)
  return body
}

const eventsOf = (id: string, event: string) =>
  h.app.db
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.resourceId, id), eq(webhookEvents.event, event)))

describe('criação', () => {
  it('devolve 200 com link, status ACTIVE e os itens ecoados', async () => {
    const checkout = await newCheckout()

    expect(checkout.status).toBe('ACTIVE')
    expect(checkout.link).toContain(`/checkoutSession/show/${checkout.id}`)
    expect(checkout.billingTypes).toEqual(['PIX'])
    expect(checkout.chargeTypes).toEqual(['DETACHED'])
    expect(checkout.minutesToExpire).toBe(100)
    expect(checkout.externalReference).toBe('pedido-42')
    expect(checkout.items[0].name).toBe('Camiseta')
    expect(checkout.callback.successUrl).toBe('https://exemplo.com/sucesso')
  })

  it('emite CHECKOUT_CREATED', async () => {
    const checkout = await newCheckout()
    const events = await eventsOf(checkout.id, 'CHECKOUT_CREATED')

    expect(events.length).toBe(1)
    expect((events[0]!.payload as any).checkout.id).toBe(checkout.id)
  })

  it('o valor é somado em CENTAVOS: 2 × R$ 100,55 = R$ 201,10', async () => {
    const checkout = await newCheckout({
      items: [
        {
          name: 'Camiseta',
          imageBase64: 'SU1BR0U=',
          quantity: 2,
          value: 100.55,
        },
      ],
    })

    // O dinheiro NUNCA é somado em reais: 2 × 100.55 em float daria 201.10000000000002.
    const [row] = await h.app.db
      .select()
      .from(checkouts)
      .where(eq(checkouts.id, checkout.id))

    expect(row!.valueCents).toBe(20110)
  })

  it('sem itens → 400 invalid_items', async () => {
    const { status, body } = await h.api.call('create-new-checkout', {
      body: { ...BODY, items: [] },
    })

    expect(status).toBe(400)
    expect(body.errors[0].code).toBe('invalid_items')
  })

  it('RECURRENT exige os dados da assinatura', async () => {
    const { status, body } = await h.api.call('create-new-checkout', {
      body: { ...BODY, chargeTypes: ['RECURRENT'] },
    })

    expect(status).toBe(400)
    expect(body.errors[0].code).toBe('invalid_subscription')
  })

  it('INSTALLMENT exige os dados do parcelamento', async () => {
    const { status, body } = await h.api.call('create-new-checkout', {
      body: { ...BODY, chargeTypes: ['INSTALLMENT'] },
    })

    expect(status).toBe(400)
    expect(body.errors[0].code).toBe('invalid_installment')
  })

  it('sem callback → 400 (a spec o declara obrigatório)', async () => {
    const { callback, ...noCallback } = BODY
    void callback

    const { status, body } = await h.api.call('create-new-checkout', { body: noCallback })

    expect(status).toBe(400)
    expect(body.errors.map((e: any) => e.code)).toContain('invalid_callback')
  })
})

describe('cancelamento', () => {
  it('ACTIVE → CANCELED, e emite CHECKOUT_CANCELED uma única vez', async () => {
    const checkout = await newCheckout()

    const canceled = await h.api.call('cancel-a-checkout', {
      params: { id: checkout.id },
      body: {},
    })
    expect(canceled.status).toBe(200)
    expect(canceled.body.status).toBe('CANCELED')

    const again = await h.api.call('cancel-a-checkout', {
      params: { id: checkout.id },
      body: {},
    })
    expect(again.status).toBe(400)
    expect(again.body.errors[0].code).toBe('invalid_action')

    const events = await eventsOf(checkout.id, 'CHECKOUT_CANCELED')
    expect(events.length).toBe(1)
  })

  it('checkout inexistente → 404', async () => {
    const { status } = await h.api.call('cancel-a-checkout', {
      params: { id: 'nao-existe' },
      body: {},
    })

    expect(status).toBe(404)
  })

  it('o checkout de outra conta não existe (404)', async () => {
    const checkout = await newCheckout()
    const other = await createSecondAccount(h, 'Conta Vizinha')

    const { status } = await h.as(other.apiKey).call('cancel-a-checkout', {
      params: { id: checkout.id },
      body: {},
    })

    expect(status).toBe(404)
  })
})
