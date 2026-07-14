/**
 * Notification — PUT individual e PUT em lote.
 *
 * As notificações nascem com o cliente (track A). Aqui elas são semeadas direto
 * no banco: o que está sob teste é a ATUALIZAÇÃO — e, principalmente, que o id de
 * uma notificação (que é adivinhável) não dá acesso à conta do vizinho.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { customers, notifications } from '../../src/db/schema/index.ts'
import { customerId, notificationId } from '../../src/domain/ids.ts'
import { notificationHandlers } from '../../src/modules/notifications/handlers.ts'
import { createHarness, createSecondAccount, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeAll(async () => {
  h = await createHarness()
})
afterAll(() => h.close())

const EVENTS = ['PAYMENT_CREATED', 'PAYMENT_OVERDUE', 'PAYMENT_RECEIVED'] as const

/** Semeia um cliente e suas notificações — é o que o track A fará ao criar o cliente. */
async function seedCustomer(accountId: string): Promise<{ id: string; notifications: string[] }> {
  const rng = h.app.ctx.rng
  const id = customerId(rng)

  await h.app.db.insert(customers).values({
    id,
    accountId,
    name: 'Cliente',
    cpfCnpj: '24971563792',
    personType: 'FISICA',
    notificationDisabled: false,
    deleted: false,
    dateCreated: h.app.ctx.clock.timestamp(),
  })

  const ids: string[] = []
  for (const event of EVENTS) {
    const notifId = notificationId(rng)
    ids.push(notifId)
    await h.app.db.insert(notifications).values({
      id: notifId,
      customerId: id,
      event,
      enabled: true,
      emailEnabledForProvider: true,
      smsEnabledForProvider: true,
      emailEnabledForCustomer: true,
      smsEnabledForCustomer: true,
      phoneCallEnabledForCustomer: false,
      whatsappEnabledForCustomer: false,
      scheduleOffset: 0,
      deleted: false,
    })
  }

  return { id, notifications: ids }
}

describe('PUT /v3/notifications/{id}', () => {
  it('atualiza os canais e o agendamento', async () => {
    const customer = await seedCustomer(h.accountId)

    const { status, body } = await h.api.call('update-existing-notification', {
      params: { id: customer.notifications[0]! },
      body: {
        enabled: false,
        smsEnabledForCustomer: false,
        whatsappEnabledForCustomer: true,
        scheduleOffset: 10,
      },
    })

    expect(status).toBe(200)
    expect(body.object).toBe('notification')
    expect(body.customer).toBe(customer.id)
    expect(body.enabled).toBe(false)
    expect(body.smsEnabledForCustomer).toBe(false)
    expect(body.whatsappEnabledForCustomer).toBe(true)
    expect(body.scheduleOffset).toBe(10)
    // O que não veio no body não muda.
    expect(body.emailEnabledForCustomer).toBe(true)
    expect(body.event).toBe('PAYMENT_CREATED')
  })

  it('scheduleOffset fora do conjunto permitido → 400', async () => {
    const customer = await seedCustomer(h.accountId)

    const { status, body } = await h.api.call('update-existing-notification', {
      params: { id: customer.notifications[0]! },
      body: { scheduleOffset: 3 },
    })

    expect(status).toBe(400)
    expect(body.errors[0].code).toBe('invalid_scheduleOffset')
  })

  it('notificação inexistente → 404', async () => {
    const { status } = await h.api.call('update-existing-notification', {
      params: { id: 'not_naoexiste00' },
      body: { enabled: false },
    })

    expect(status).toBe(404)
  })

  it('a notificação de um cliente de OUTRA conta não existe (404)', async () => {
    const mine = await seedCustomer(h.accountId)
    const other = await createSecondAccount(h, 'Conta Vizinha')

    const { status } = await h.as(other.apiKey).call('update-existing-notification', {
      params: { id: mine.notifications[0]! },
      body: { enabled: false },
    })

    expect(status).toBe(404)
  })
})

describe('PUT /v3/notifications/batch', () => {
  it('atualiza várias e devolve TODAS as notificações do cliente', async () => {
    const customer = await seedCustomer(h.accountId)

    const { status, body } = await h.api.call('update-existing-notifications-in-batch', {
      body: {
        customer: customer.id,
        notifications: [
          { id: customer.notifications[0], enabled: false },
          { id: customer.notifications[1], phoneCallEnabledForCustomer: true, scheduleOffset: 5 },
        ],
      },
    })

    expect(status).toBe(200)
    expect(body.notifications.length).toBe(EVENTS.length)

    const byId = new Map<string, any>(
      body.notifications.map((n: any) => [n.id as string, n]),
    )
    expect(byId.get(customer.notifications[0]!)!.enabled).toBe(false)
    expect(byId.get(customer.notifications[1]!)!.phoneCallEnabledForCustomer).toBe(true)
    expect(byId.get(customer.notifications[1]!)!.scheduleOffset).toBe(5)
    expect(byId.get(customer.notifications[2]!)!.enabled).toBe(true) // intocada
  })

  it('sem customer → 400 invalid_customer', async () => {
    const { status, body } = await h.api.call('update-existing-notifications-in-batch', {
      body: { notifications: [] },
    })

    expect(status).toBe(400)
    expect(body.errors.map((e: any) => e.code)).toContain('invalid_customer')
  })

  it('um id de outro cliente no lote recusa o LOTE INTEIRO', async () => {
    const a = await seedCustomer(h.accountId)
    const b = await seedCustomer(h.accountId)

    const { status } = await h.api.call('update-existing-notifications-in-batch', {
      body: {
        customer: a.id,
        notifications: [
          { id: a.notifications[0], enabled: false },
          { id: b.notifications[0], enabled: false },
        ],
      },
    })

    expect(status).toBe(404)

    // Nada foi aplicado: um lote pela metade seria pior que um lote recusado.
    const check = await h.api.call('update-existing-notifications-in-batch', {
      body: { customer: a.id, notifications: [] },
    })
    const first = check.body.notifications.find((n: any) => n.id === a.notifications[0])
    expect(first.enabled).toBe(true)
  })

  it('cliente de outra conta → 404', async () => {
    const mine = await seedCustomer(h.accountId)
    const other = await createSecondAccount(h, 'Vizinha do Lote')

    const { status } = await h.as(other.apiKey).call('update-existing-notifications-in-batch', {
      body: { customer: mine.id, notifications: [] },
    })

    expect(status).toBe(404)
  })
})
