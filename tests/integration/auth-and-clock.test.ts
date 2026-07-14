import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createHarness, TEST_API_KEY, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeAll(async () => {
  h = await createHarness()
})
afterAll(() => h.close())

describe('autenticação', () => {
  const call = (headers: Record<string, string>) =>
    h.app.app.handle(new Request('http://localhost/v3/payments', { headers }))

  it('sem access_token → 401 invalid_access_token', async () => {
    const res = await call({})
    expect(res.status).toBe(401)
    expect(((await res.json()) as any).errors[0].code).toBe('invalid_access_token')
  })

  it('token com formato errado → 401 invalid_access_token_format', async () => {
    // O Asaas distingue os dois casos, e isso é útil: o cliente sabe se colou a
    // chave errada ou se ela foi revogada.
    const res = await call({ access_token: 'abc123' })
    expect(res.status).toBe(401)
    expect(((await res.json()) as any).errors[0].code).toBe('invalid_access_token_format')
  })

  it('token com formato certo mas inexistente → 401 invalid_access_token', async () => {
    const res = await call({ access_token: '$aact_hmlg_naoexiste' })
    expect(res.status).toBe(401)
    expect(((await res.json()) as any).errors[0].code).toBe('invalid_access_token')
  })

  it('token válido passa da autenticação (chega no handler)', async () => {
    const res = await call({ access_token: TEST_API_KEY })
    // O que importa é que NÃO é 401: autenticou e chegou no handler.
    expect(res.status).not.toBe(401)
    expect(res.status).toBe(200)
  })
})

describe('relógio virtual', () => {
  it('começa congelado na data configurada', () => {
    expect(h.clock.mode).toBe('VIRTUAL_FROZEN')
    expect(h.app.ctx.clock.today()).toBe('2026-01-05')
  })

  it('congelado significa congelado: o tempo real não vaza', async () => {
    const before = h.app.ctx.clock.timestamp()
    await Bun.sleep(30)
    expect(h.app.ctx.clock.timestamp()).toBe(before)
  })

  it('advance(32 dias) roda UM TICK POR DIA SIMULADO, não um salto só', async () => {
    // Se fosse um tick só em T+32, uma assinatura geraria uma cobrança em vez de
    // várias e o OVERDUE seria carimbado com a data errada.
    const reports = await h.advance({ days: 32 })

    expect(reports.length).toBe(32)
    expect(reports[0]!.tickKey).toBe('2026-01-06')
    expect(reports.at(-1)!.tickKey).toBe('2026-02-06')
    expect(h.app.ctx.clock.today()).toBe('2026-02-06')
  })

  it('jobs diários são idempotentes: dez ticks no mesmo dia = uma execução', async () => {
    const { jobRuns } = await import('../../src/db/schema/index.ts')

    for (let i = 0; i < 10; i++) await h.tick()

    const runs = await h.app.db.select().from(jobRuns)
    const today = h.app.ctx.clock.today()
    const todayRuns = runs.filter((r) => r.tickKey === today)

    // Nenhum par (job, dia) se repete — é a garantia da PK composta.
    const keys = todayRuns.map((r) => `${r.jobName}:${r.tickKey}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('paginação e formato de erro', () => {
  it('erro sempre vem como array, mesmo com um erro só', async () => {
    const res = await h.app.app.handle(
      new Request('http://localhost/v3/customers', {
        method: 'POST',
        headers: { access_token: TEST_API_KEY, 'content-type': 'application/json' },
        body: '{}',
      }),
    )

    expect(res.status).toBe(400) // 400, não o 422 padrão do Elysia
    const body = (await res.json()) as any
    expect(Array.isArray(body.errors)).toBe(true)

    // O padrão real do Asaas é `invalid_<campo>`, em camelCase igual ao request.
    const codes = body.errors.map((e: any) => e.code)
    expect(codes).toContain('invalid_name')
    expect(codes).toContain('invalid_cpfCnpj')
  })
})
