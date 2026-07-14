/**
 * Credit Bureau Report — consulta ao Serasa.
 *
 * A assimetria que quebra integração e que está coberta aqui: `reportFile` (o PDF
 * em base64) SÓ vem na resposta da criação. Quem recuperar o relatório depois
 * recebe null e precisa usar o `downloadUrl`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { customers } from '../../src/db/schema/index.ts'
import { customerId } from '../../src/domain/ids.ts'
import { creditBureauHandlers } from '../../src/modules/credit-bureau/handlers.ts'
import { createHarness, createSecondAccount, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeAll(async () => {
  h = await createHarness()
})
afterAll(() => h.close())

async function seedCustomer(accountId: string, cpfCnpj = '24971563792'): Promise<string> {
  const id = customerId(h.app.ctx.rng)
  await h.app.db.insert(customers).values({
    id,
    accountId,
    name: 'Cliente Consultado',
    cpfCnpj,
    personType: cpfCnpj.length === 14 ? 'JURIDICA' : 'FISICA',
    notificationDisabled: false,
    deleted: false,
    dateCreated: h.app.ctx.clock.timestamp(),
  })
  return id
}

describe('consulta', () => {
  it('por CPF/CNPJ avulso: 200, reportFile em base64, dateCreated só a data', async () => {
    const { status, body } = await h.api.call('make-consultation', {
      body: { cpfCnpj: '24971563792' },
    })

    expect(status).toBe(200)
    expect(body.cpfCnpj).toBe('24971563792')
    expect(body.customer).toBeNull()
    expect(body.dateCreated).toBe('2026-01-05') // relógio virtual, não o de verdade
    expect(body.downloadUrl).toContain(`/creditBureauReport/download/${body.id}`)
    expect(typeof body.reportFile).toBe('string')
  })

  it('por cliente: o documento consultado é o do cliente', async () => {
    const customer = await seedCustomer(h.accountId, '47960950000121')

    const { status, body } = await h.api.call('make-consultation', {
      body: { customer },
    })

    expect(status).toBe(200)
    expect(body.customer).toBe(customer)
    expect(body.cpfCnpj).toBe('47960950000121')
  })

  it('a taxa cobrada sai de config.fees e depende do tipo de pessoa', async () => {
    const { creditBureauReports } = await import('../../src/db/schema/index.ts')
    const { eq } = await import('drizzle-orm')

    const pf = await h.api.call('make-consultation', { body: { cpfCnpj: '24971563792' } })
    const pj = await h.api.call('make-consultation', { body: { cpfCnpj: '47960950000121' } })

    const [rowPf] = await h.app.db
      .select()
      .from(creditBureauReports)
      .where(eq(creditBureauReports.id, pf.body.id))
    const [rowPj] = await h.app.db
      .select()
      .from(creditBureauReports)
      .where(eq(creditBureauReports.id, pj.body.id))

    expect(rowPf!.feeCents).toBe(h.app.config.fees.creditBureauReport.naturalPerson)
    expect(rowPj!.feeCents).toBe(h.app.config.fees.creditBureauReport.legalPerson)
  })

  it('sem cliente e sem CPF/CNPJ → 400', async () => {
    const { status, body } = await h.api.call('make-consultation', { body: {} })

    expect(status).toBe(400)
    expect(body.errors[0].code).toBe('invalid_cpfCnpj')
  })

  it('CPF/CNPJ inválido → 400 (o dígito verificador é conferido de verdade)', async () => {
    const { status, body } = await h.api.call('make-consultation', {
      body: { cpfCnpj: '11111111111' },
    })

    expect(status).toBe(400)
    expect(body.errors[0].code).toBe('invalid_cpfCnpj')
  })

  it('cliente de outra conta → 404', async () => {
    const other = await createSecondAccount(h, 'Conta Vizinha')
    const alien = await seedCustomer(other.accountId)

    const { status } = await h.api.call('make-consultation', { body: { customer: alien } })
    expect(status).toBe(404)
  })
})

describe('recuperação e listagem', () => {
  it('recuperar não devolve o reportFile — só o downloadUrl', async () => {
    const created = await h.api.call('make-consultation', {
      body: { cpfCnpj: '24971563792' },
    })

    const { status, body } = await h.api.call('retrieve-a-credit-bureau-report', {
      params: { id: created.body.id },
    })

    expect(status).toBe(200)
    expect(body.id).toBe(created.body.id)
    expect(body.reportFile).toBeNull()
    expect(body.downloadUrl).toBe(created.body.downloadUrl)
  })

  it('listagem no envelope do Asaas, com filtro de período', async () => {
    await h.api.call('make-consultation', { body: { cpfCnpj: '24971563792' } })

    const all = await h.api.call('list-credit-bureau-reports')
    expect(all.status).toBe(200)
    expect(all.body.object).toBe('list')
    expect(all.body.totalCount).toBeGreaterThan(0)
    expect(all.body.data[0].reportFile).toBeNull()

    const hoje = await h.api.call('list-credit-bureau-reports', {
      query: { startDate: '2026-01-05', endDate: '2026-01-05' },
    })
    expect(hoje.body.totalCount).toBe(all.body.totalCount)

    const outroDia = await h.api.call('list-credit-bureau-reports', {
      query: { startDate: '2026-02-01', endDate: '2026-02-28' },
    })
    expect(outroDia.body.totalCount).toBe(0)
  })

  it('relatório de outra conta → 404, e a listagem dela não vê o nosso', async () => {
    const created = await h.api.call('make-consultation', {
      body: { cpfCnpj: '24971563792' },
    })
    const other = await createSecondAccount(h, 'Conta Curiosa')
    const client = h.as(other.apiKey)

    const fetched = await client.call('retrieve-a-credit-bureau-report', {
      params: { id: created.body.id },
    })
    expect(fetched.status).toBe(404)

    const listed = await client.call('list-credit-bureau-reports')
    expect(listed.body.totalCount).toBe(0)
  })
})
