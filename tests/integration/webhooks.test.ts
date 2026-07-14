/**
 * O motor de webhook — o teste que justifica o projeto.
 *
 * Tudo aqui roda contra um servidor HTTP DE VERDADE (o WebhookSink), com fetch de
 * verdade: é a única forma de exercitar o header `asaas-access-token`, o timeout,
 * e a regra de que só HTTP 200 é sucesso. Um espião em memória passaria nos
 * mesmos asserts sem testar nada do que quebra na vida real.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { HOUR_MS, MINUTE_MS } from '../../src/core/clock.ts'
import type { DomainEvent } from '../../src/core/events.ts'
import { webhookDeliveries, webhooks } from '../../src/db/schema/index.ts'
import { BACKOFF_MS } from '../../src/webhooks/backoff.ts'
import { rewriteForContainer, resetRewriteNotice } from '../../src/webhooks/rewrite.ts'
import { createHarness, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

/** Cria o webhook pela API — é assim que o usuário do simulador faz. */
async function createWebhook(overrides: Record<string, unknown> = {}) {
  const res = await h.api.call('create-new-webhook', {
    body: {
      name: 'Integração',
      url: h.sink.url,
      email: 'dev@localhost',
      sendType: 'NON_SEQUENTIALLY',
      authToken: 'a'.repeat(32),
      events: ['PAYMENT_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'],
      ...overrides,
    },
  })
  expect(res.status).toBe(200)
  return res.body
}

/**
 * Emite um evento de domínio direto, como um handler de cobrança faria dentro da
 * sua transação. O payload é CONGELADO aqui.
 */
async function emit(event: string, resource: Record<string, unknown>): Promise<void> {
  const domainEvent: DomainEvent = {
    accountId: h.accountId,
    event,
    resourceType: 'payment',
    resourceId: String(resource.id),
    resource,
  }
  await h.app.ctx.emit(h.app.db, domainEvent)
}

const deliveries = () =>
  h.app.db.select().from(webhookDeliveries).orderBy(webhookDeliveries.sequence)

const webhookRow = (id: string) =>
  h.app.db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, id))
    .limit(1)
    .then((r) => r[0]!)

// ────────────────────────────────────────────────────────── CRUD

describe('webhooks — CRUD', () => {
  it('cria, recupera, lista e remove — e nunca devolve o authToken', async () => {
    const created = await createWebhook({ name: 'Meu webhook' })

    expect(created.id).toBeString()
    expect(created.name).toBe('Meu webhook')
    expect(created.enabled).toBe(true)
    expect(created.interrupted).toBe(false)
    expect(created.apiVersion).toBe(3)
    // O token só sai daqui dentro do header de uma entrega.
    expect(created.hasAuthToken).toBe(true)
    expect(created).not.toHaveProperty('authToken')
    expect(created.events).toEqual([
      'PAYMENT_CREATED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
    ])

    const got = await h.api.call('retrieve-a-single-webhook', {
      params: { id: created.id },
    })
    expect(got.body.id).toBe(created.id)

    const list = await h.api.call('list-webhooks')
    expect(list.body.object).toBe('list')
    expect(list.body.totalCount).toBe(1)
    expect(list.body.data[0].id).toBe(created.id)

    const del = await h.api.call('remove-webhook', { params: { id: created.id } })
    expect(del.body).toEqual({ deleted: true, id: created.id })

    const gone = await h.api.call('retrieve-a-single-webhook', {
      params: { id: created.id },
    })
    expect(gone.status).toBe(404)
  })

  it('recusa o 11º webhook da conta', async () => {
    for (let i = 0; i < 10; i++) await createWebhook({ name: `w${i}` })

    const res = await h.api.call('create-new-webhook', {
      body: {
        name: 'o décimo primeiro',
        url: h.sink.url,
        email: 'dev@localhost',
        sendType: 'NON_SEQUENTIALLY',
        events: ['PAYMENT_RECEIVED'],
      },
    })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].description).toContain('limite de 10 webhooks')
  })

  it('recusa authToken fora de 32–255 caracteres', async () => {
    const res = await h.api.call('create-new-webhook', {
      body: {
        name: 'curto demais',
        url: h.sink.url,
        email: 'dev@localhost',
        sendType: 'NON_SEQUENTIALLY',
        authToken: 'curto',
        events: ['PAYMENT_RECEIVED'],
      },
    })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_authToken')
  })
})

// ────────────────────────────────────────────────────────── entrega

describe('webhooks — entrega', () => {
  it('entrega o evento no envelope do Asaas, com o header asaas-access-token', async () => {
    const wh = await createWebhook({ authToken: 'tok_'.padEnd(40, 'x') })
    await emit('PAYMENT_RECEIVED', { id: 'pay_000000000001', value: 100 })

    const report = await h.tick()

    expect(h.sink.received).toHaveLength(1)
    const [got] = h.sink.received

    expect(got!.headers['asaas-access-token']).toBe('tok_'.padEnd(40, 'x'))
    expect(got!.headers['content-type']).toContain('application/json')

    // O envelope EXATO do Asaas.
    expect(got!.payload.id).toStartWith('evt_')
    expect(got!.payload.event).toBe('PAYMENT_RECEIVED')
    expect(got!.payload.dateCreated).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(got!.payload.account).toEqual({ id: h.accountId, ownerId: null })
    expect(got!.payload.payment).toEqual({ id: 'pay_000000000001', value: 100 })

    expect(report.webhooks.delivered).toHaveLength(1)
    expect(report.webhooks.delivered[0]!.statusCode).toBe(200)
    expect(report.webhooks.failed).toEqual([])

    const [d] = await deliveries()
    expect(d!.status).toBe('DELIVERED')
    expect(d!.lastStatusCode).toBe(200)
    expect(d!.attempt).toBe(1)
    expect(d!.lastAttemptAt).toBe(h.app.ctx.clock.timestamp())

    // O webhook não trava quando tudo dá certo.
    expect((await webhookRow(wh.id)).interrupted).toBe(false)
  })

  it('não manda o header quando o webhook não tem authToken', async () => {
    await createWebhook({ authToken: undefined })
    await emit('PAYMENT_RECEIVED', { id: 'pay_000000000001' })
    await h.tick()

    expect(h.sink.received[0]!.headers['asaas-access-token']).toBeUndefined()
  })

  it('HTTP 201 é FALHA — só 200 é sucesso no Asaas', async () => {
    await createWebhook()
    h.sink.respondWith(201)

    await emit('PAYMENT_RECEIVED', { id: 'pay_000000000001' })
    const report = await h.tick()

    expect(h.sink.received).toHaveLength(1) // chegou…
    expect(report.webhooks.delivered).toEqual([]) // …mas NÃO conta como entregue.
    expect(report.webhooks.failed).toHaveLength(1)

    const [d] = await deliveries()
    expect(d!.status).toBe('PENDING')
    expect(d!.attempt).toBe(1)
    expect(d!.lastStatusCode).toBe(201)
    expect(d!.lastError).toContain('HTTP 201')
    // Reagendada para o offset 2 da tabela: 30s.
    expect(d!.nextAttemptAtMs).toBe(h.clock.nowMs() + 30_000)
  })

  it('204 também é falha; 200 no retry fecha a entrega', async () => {
    await createWebhook()
    h.sink.failNext(1, 204) // a primeira responde 204, as seguintes 200

    await emit('PAYMENT_CONFIRMED', { id: 'pay_000000000001' })
    await h.tick()

    let [d] = await deliveries()
    expect(d!.status).toBe('PENDING')
    expect(d!.lastStatusCode).toBe(204)

    h.clock.advance(30_000)
    await h.tick()

    ;[d] = await deliveries()
    expect(d!.status).toBe('DELIVERED')
    expect(d!.lastStatusCode).toBe(200)
    expect(d!.attempt).toBe(2)
    expect(h.sink.received).toHaveLength(2)
  })

  it('o dispatcher pausado não entrega nada', async () => {
    await createWebhook()
    await emit('PAYMENT_RECEIVED', { id: 'pay_000000000001' })

    h.app.scheduler.paused = true
    await h.tick()
    expect(h.sink.received).toHaveLength(0)

    h.app.scheduler.paused = false
    await h.tick()
    expect(h.sink.received).toHaveLength(1)
  })

  it('webhook desabilitado não recebe nada', async () => {
    const wh = await createWebhook()
    await h.api.call('update-existing-webhook', {
      params: { id: wh.id },
      body: { enabled: false },
    })

    await emit('PAYMENT_RECEIVED', { id: 'pay_000000000001' })
    await h.tick()

    expect(h.sink.received).toHaveLength(0)
  })
})

// ────────────────────────────────────────────────────────── backoff

describe('webhooks — backoff de 15 tentativas', () => {
  it('percorre os offsets EXATOS da tabela, interrompe, e removeBackoff destrava', async () => {
    const wh = await createWebhook()
    h.sink.respondWith(500)

    await emit('PAYMENT_RECEIVED', { id: 'pay_000000000001', value: 4990 })

    // 1ª tentativa: imediata (offset 0 da tabela).
    await h.tick()
    expect(h.sink.received).toHaveLength(1)

    let [d] = await deliveries()
    expect(d!.attempt).toBe(1)
    expect(d!.lastStatusCode).toBe(500)

    // As 14 esperas seguintes. A tabela do Asaas, decorada:
    const expected = [
      30_000,
      MINUTE_MS,
      3 * MINUTE_MS + 30_000,
      5 * MINUTE_MS,
      15 * MINUTE_MS,
      25 * MINUTE_MS,
      HOUR_MS,
      HOUR_MS,
      HOUR_MS,
      HOUR_MS,
      HOUR_MS,
      2 * HOUR_MS,
      2 * HOUR_MS,
      3 * HOUR_MS,
    ]
    expect(BACKOFF_MS.slice(1)).toEqual(expected)

    for (const [i, offset] of expected.entries()) {
      const attemptsBefore = i + 1
      ;[d] = await deliveries()
      expect(d!.nextAttemptAtMs).toBe(h.clock.nowMs() + offset)

      // Um instante ANTES do offset: nada acontece. É o backoff funcionando.
      h.clock.advance(offset - 1)
      await h.tick()
      expect(h.sink.received).toHaveLength(attemptsBefore)

      // No offset exato: a tentativa sai.
      h.clock.advance(1)
      await h.tick()
      expect(h.sink.received).toHaveLength(attemptsBefore + 1)
      ;[d] = await deliveries()
      expect(d!.attempt).toBe(attemptsBefore + 1)
    }

    // 15 tentativas, todas com 500. Fim da linha.
    expect(h.sink.received).toHaveLength(15)
    ;[d] = await deliveries()
    expect(d!.attempt).toBe(15)
    expect(d!.status).toBe('INTERRUPTED')
    expect(d!.nextAttemptAtMs).toBeNull()

    // E a fila INTEIRA do webhook congela — é o que o Asaas faz.
    expect((await webhookRow(wh.id)).interrupted).toBe(true)
    const view = await h.api.call('retrieve-a-single-webhook', { params: { id: wh.id } })
    expect(view.body.interrupted).toBe(true)

    // Um tick a mais não tenta de novo: interrompido é interrompido.
    h.clock.advance(24 * HOUR_MS)
    await h.tick()
    expect(h.sink.received).toHaveLength(15)

    // O dev conserta a rota dele…
    h.sink.respondWith(200)

    // …e destrava a fila.
    const un = await h.api.call('remove-webhook-backoff', { params: { id: wh.id } })
    expect(un.status).toBe(204)

    expect((await webhookRow(wh.id)).interrupted).toBe(false)
    ;[d] = await deliveries()
    expect(d!.status).toBe('PENDING')
    expect(d!.attempt).toBe(0)

    await h.tick()

    expect(h.sink.received).toHaveLength(16)
    expect(h.sink.received[15]!.payload.event).toBe('PAYMENT_RECEIVED')
    // O payload reentregue é o do emit — não uma consulta ao estado atual.
    expect(h.sink.received[15]!.payload.payment).toEqual({
      id: 'pay_000000000001',
      value: 4990,
    })
    ;[d] = await deliveries()
    expect(d!.status).toBe('DELIVERED')
  })

  it('um PUT com interrupted: false também reativa a fila', async () => {
    const wh = await createWebhook()

    await h.app.db
      .update(webhooks)
      .set({ interrupted: true })
      .where(eq(webhooks.id, wh.id))

    await emit('PAYMENT_RECEIVED', { id: 'pay_000000000001' })
    await h.tick()
    expect(h.sink.received).toHaveLength(0) // interrompido: não entrega

    const res = await h.api.call('update-existing-webhook', {
      params: { id: wh.id },
      body: { interrupted: false },
    })
    expect(res.body.interrupted).toBe(false)

    await h.tick()
    expect(h.sink.received).toHaveLength(1)
  })
})

// ────────────────────────────────────────────────────────── SEQUENTIALLY

describe('webhooks — SEQUENTIALLY faz head-of-line blocking', () => {
  it('o 1º evento travado segura os eventos 2 e 3; quando ele passa, os 3 chegam em ordem', async () => {
    await createWebhook({ sendType: 'SEQUENTIALLY' })
    h.sink.respondWith(500)

    await emit('PAYMENT_CREATED', { id: 'pay_000000000001' })
    await emit('PAYMENT_CONFIRMED', { id: 'pay_000000000001' })
    await emit('PAYMENT_RECEIVED', { id: 'pay_000000000001' })

    const rows = await deliveries()
    expect(rows.map((r) => r.sequence)).toEqual([1, 2, 3])

    await h.tick()

    // SÓ a cabeça da fila foi tentada. Os outros dois estão vencidos e mesmo
    // assim NÃO saíram: é o head-of-line blocking do Asaas.
    expect(h.sink.eventNames).toEqual(['PAYMENT_CREATED'])
    let all = await deliveries()
    expect(all.map((r) => r.attempt)).toEqual([1, 0, 0])
    expect(all.map((r) => r.status)).toEqual(['PENDING', 'PENDING', 'PENDING'])

    // Passa o tempo: a fila continua travada na mesma entrega.
    h.clock.advance(30_000)
    await h.tick()
    expect(h.sink.eventNames).toEqual(['PAYMENT_CREATED', 'PAYMENT_CREATED'])

    all = await deliveries()
    expect(all.map((r) => r.attempt)).toEqual([2, 0, 0])

    // O endpoint volta. Agora a fila drena — em ordem.
    h.sink.respondWith(200)
    h.clock.advance(MINUTE_MS)
    await h.tick()

    expect(h.sink.eventNames).toEqual([
      'PAYMENT_CREATED',
      'PAYMENT_CREATED',
      'PAYMENT_CREATED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
    ])

    all = await deliveries()
    expect(all.map((r) => r.status)).toEqual(['DELIVERED', 'DELIVERED', 'DELIVERED'])
  })

  it('NON_SEQUENTIALLY entrega os vencidos mesmo com um falhando', async () => {
    await createWebhook({ sendType: 'NON_SEQUENTIALLY' })
    h.sink.failNext(1, 500) // só a PRIMEIRA requisição falha

    await emit('PAYMENT_CREATED', { id: 'pay_000000000001' })
    await emit('PAYMENT_CONFIRMED', { id: 'pay_000000000001' })
    await emit('PAYMENT_RECEIVED', { id: 'pay_000000000001' })

    await h.tick()

    // As três foram tentadas no mesmo tick — sem bloqueio de fila.
    expect(h.sink.received).toHaveLength(3)

    const all = await deliveries()
    const statuses = all.map((r) => r.status)
    expect(statuses.filter((s) => s === 'DELIVERED')).toHaveLength(2)
    expect(statuses.filter((s) => s === 'PENDING')).toHaveLength(1)
  })
})

// ────────────────────────────────────────────────────────── payload congelado

describe('webhooks — o payload é congelado no emit', () => {
  it('entrega o recurso como ele era no emit, não como está agora', async () => {
    await createWebhook({ sendType: 'SEQUENTIALLY' })
    // Nada é entregue enquanto o dispatcher estiver pausado — é a viagem no
    // tempo "pura", com a fila parada.
    h.app.scheduler.paused = true

    const payment = { id: 'pay_000000000001', status: 'PENDING', value: 10_000 }
    await emit('PAYMENT_CREATED', { ...payment })

    // O recurso muda depois do emit: é pago, e o valor é corrigido.
    payment.status = 'RECEIVED'
    payment.value = 12_345
    await emit('PAYMENT_RECEIVED', { ...payment })

    h.app.scheduler.paused = false
    h.clock.advance(HOUR_MS)
    await h.tick()

    expect(h.sink.received).toHaveLength(2)

    // A 1ª entrega carrega o fato como ele era — PENDING, 10.000 —, e não o
    // estado atual do recurso. O evento descreve um instante, não uma consulta.
    expect(h.sink.received[0]!.payload.event).toBe('PAYMENT_CREATED')
    expect(h.sink.received[0]!.payload.payment).toEqual({
      id: 'pay_000000000001',
      status: 'PENDING',
      value: 10_000,
    })

    expect(h.sink.received[1]!.payload.event).toBe('PAYMENT_RECEIVED')
    expect(h.sink.received[1]!.payload.payment).toEqual({
      id: 'pay_000000000001',
      status: 'RECEIVED',
      value: 12_345,
    })
  })
})

// ────────────────────────────────────────────────────────── retenção

describe('webhooks — retenção', () => {
  it('entrega pendente além da janela de retenção vira EXPIRED', async () => {
    const wh = await createWebhook()
    h.app.scheduler.paused = true // a fila para, o tempo não

    await emit('PAYMENT_RECEIVED', { id: 'pay_000000000001' })

    h.clock.advance(15 * 24 * HOUR_MS) // retenção = 14 dias
    h.app.scheduler.paused = false
    await h.tick()

    expect(h.sink.received).toHaveLength(0)

    const [d] = await h.app.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, wh.id))

    expect(d!.status).toBe('EXPIRED')
  })
})

// ────────────────────────────────────────────────────────── a pegadinha do Docker

describe('webhooks — reescrita de host para o Docker', () => {
  beforeEach(() => resetRewriteNotice())

  it('reescreve localhost preservando porta, path e query', () => {
    expect(
      rewriteForContainer('http://localhost:3000/hook?x=1#f', 'host.docker.internal'),
    ).toBe('http://host.docker.internal:3000/hook?x=1#f')

    expect(rewriteForContainer('http://127.0.0.1:8080/webhook', 'host.docker.internal')).toBe(
      'http://host.docker.internal:8080/webhook',
    )

    expect(rewriteForContainer('http://[::1]:9000/w', 'host.docker.internal')).toBe(
      'http://host.docker.internal:9000/w',
    )
  })

  it('não toca em host externo, e não reescreve nada sem o target', () => {
    expect(rewriteForContainer('https://api.exemplo.com/hook', 'host.docker.internal')).toBe(
      'https://api.exemplo.com/hook',
    )
    // Fora do Docker (o caso dos testes e do `bun run dev`): nada muda.
    expect(rewriteForContainer('http://localhost:3000/hook', undefined)).toBe(
      'http://localhost:3000/hook',
    )
  })

  it('avisa UMA vez, em nível info — é a pegadinha nº 1 do projeto', () => {
    const logged: { level: string; msg: string }[] = []
    const log = (level: string, msg: string) => logged.push({ level, msg })

    rewriteForContainer('http://localhost:3000/a', 'host.docker.internal', log as never)
    rewriteForContainer('http://localhost:3000/b', 'host.docker.internal', log as never)

    expect(logged).toHaveLength(1)
    expect(logged[0]!.level).toBe('info')
    expect(logged[0]!.msg).toContain('host.docker.internal')
  })
})

void and // mantém o import usado pela tipagem do drizzle
