/**
 * O ciclo de vida da cobrança. É o critério de aceite do projeto.
 *
 * Cada cenário aqui é uma coisa que o sandbox do Asaas NÃO permite testar:
 * esperar D+32 para o cartão creditar, ver o juro crescer um dia por vez, ou
 * conferir que o extrato fecha com o saldo.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { financialTransactions } from '../../src/db/schema/index.ts'
import { createHarness, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

/** Cria um cliente e devolve o id. */
async function customer(): Promise<string> {
  const res = await h.api.call('create-new-customer', {
    body: { name: 'Fulano de Tal', cpfCnpj: '24971563792' },
  })
  expect(res.status).toBe(200) // 200, nunca 201
  return res.body.id
}

const ledgerOf = async (accountId: string) =>
  h.app.db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.accountId, accountId))

describe('Pix — credita na hora e pula CONFIRMED', () => {
  it('PENDING → RECEIVED direto, com taxa fixa de R$ 1,99 no extrato', async () => {
    const cus = await customer()

    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'PIX', value: 100, dueDate: '2026-01-10' },
    })

    expect(created.body.status).toBe('PENDING')
    // netValue = 100 − 1,99. A taxa do Pix é FIXA, não percentual.
    expect(created.body.value).toBe(100)
    expect(created.body.netValue).toBe(98.01)

    const paid = await h.api.call('confirm-payment', { params: { id: created.body.id } })

    // O Pix NÃO passa por CONFIRMED — vai direto a RECEIVED, com o dinheiro já
    // disponível. Todo o resto (boleto, cartão) para em CONFIRMED antes.
    expect(paid.body.status).toBe('RECEIVED')
    expect(paid.body.creditDate).toBe('2026-01-05')

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual(['PAYMENT_RECEIVED', 'PAYMENT_FEE'])
    expect(ledger[0]!.valueCents).toBe(10_000) // +R$ 100,00 bruto
    expect(ledger[1]!.valueCents).toBe(-199) // −R$ 1,99 de taxa
    expect(ledger[1]!.balanceCents).toBe(9801) // saldo final = netValue

    await h.assertLedgerBalances()
  })

  it('nenhum webhook PAYMENT_CONFIRMED é emitido para Pix', async () => {
    await h.subscribeWebhook(['PAYMENT_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])

    const cus = await customer()
    const p = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'PIX', value: 50, dueDate: '2026-01-10' },
    })
    await h.api.call('confirm-payment', { params: { id: p.body.id } })
    await h.tick() // o dispatcher roda no tick

    const events = h.sink.eventNames
    expect(events).toContain('PAYMENT_CREATED')
    expect(events).toContain('PAYMENT_RECEIVED')
    // O Pix pula CONFIRMED — quem assina esse evento nunca o recebe num Pix.
    expect(events).not.toContain('PAYMENT_CONFIRMED')
  })
})

describe('Cartão de crédito — CONFIRMED agora, dinheiro em D+32', () => {
  it('o saldo só aparece 32 dias depois — e a viagem no tempo prova isso', async () => {
    const cus = await customer()

    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'CREDIT_CARD', value: 100, dueDate: '2026-01-10' },
    })

    // Taxa do cartão à vista: R$ 0,49 + 2,99% = R$ 3,48 → líquido R$ 96,52
    expect(created.body.netValue).toBe(96.52)

    const confirmed = await h.api.call('confirm-payment', { params: { id: created.body.id } })
    expect(confirmed.body.status).toBe('CONFIRMED')
    expect(confirmed.body.estimatedCreditDate).toBe('2026-02-06') // 05/01 + 32 dias

    // Confirmada, mas o dinheiro NÃO está na conta.
    expect((await ledgerOf(h.accountId)).length).toBe(0)

    // Avança 31 dias: ainda nada.
    await h.advance({ days: 31 })
    let p = await h.api.call('retrieve-a-single-payment', { params: { id: created.body.id } })
    expect(p.body.status).toBe('CONFIRMED')

    // O 32º dia. É este o teste que o sandbox real não deixa você fazer.
    const [report] = await h.advance({ days: 1 })

    expect(report!.transitions).toContainEqual({
      resource: 'payment',
      id: created.body.id,
      from: 'CONFIRMED',
      to: 'RECEIVED',
      job: 'credit-settlement',
    })

    p = await h.api.call('retrieve-a-single-payment', { params: { id: created.body.id } })
    expect(p.body.status).toBe('RECEIVED')
    expect(p.body.creditDate).toBe('2026-02-06')

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual(['PAYMENT_RECEIVED', 'PAYMENT_FEE'])
    expect(ledger[1]!.balanceCents).toBe(9652) // R$ 96,52

    await h.assertLedgerBalances()
  })
})

describe('Boleto — vence, acumula juros, e credita em D+1 útil', () => {
  it('PENDING → OVERDUE quando passa do vencimento', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'BOLETO', value: 100, dueDate: '2026-01-06' },
    })

    const reports = await h.advance({ days: 2 }) // hoje vira 07/01

    const overdueTick = reports.find((r) =>
      r.transitions.some((t) => t.to === 'OVERDUE' && t.id === created.body.id),
    )
    expect(overdueTick).toBeDefined()

    const p = await h.api.call('retrieve-a-single-payment', { params: { id: created.body.id } })
    expect(p.body.status).toBe('OVERDUE')
  })

  it('pago em atraso: valor = original + multa (uma vez) + juros pro-rata', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'BOLETO',
        value: 100,
        dueDate: '2026-01-05',
        fine: { value: 2, type: 'PERCENTAGE' }, // 2%
        interest: { value: 1 }, // 1% ao mês
      },
    })

    await h.advance({ days: 10 }) // 15/01 — 10 dias de atraso

    const paid = await h.api.call('confirm-payment', { params: { id: created.body.id } })

    // multa 2% = R$ 2,00 | juros = 100 × 1% / 30 × 10 = R$ 0,33
    expect(paid.body.originalValue).toBe(100)
    expect(paid.body.interestValue).toBe(2.33)
    expect(paid.body.value).toBe(102.33)
    expect(paid.body.status).toBe('CONFIRMED') // boleto passa por CONFIRMED

    // Boleto credita no próximo dia útil. 15/01/2026 é quinta → 16/01, sexta.
    expect(paid.body.estimatedCreditDate).toBe('2026-01-16')

    await h.advance({ days: 1 })
    const settled = await h.api.call('retrieve-a-single-payment', {
      params: { id: created.body.id },
    })
    expect(settled.body.status).toBe('RECEIVED')

    const ledger = await ledgerOf(h.accountId)
    expect(ledger[0]!.valueCents).toBe(10_233) // creditou o valor COM juros
    expect(ledger[1]!.valueCents).toBe(-199) // taxa do boleto

    await h.assertLedgerBalances()
  })
})

describe('Recebimento em dinheiro — NÃO gera saldo', () => {
  it('vai a RECEIVED_IN_CASH sem tocar no extrato', async () => {
    // É fácil errar isso: o dinheiro entrou no bolso do lojista, FORA da
    // plataforma. O Asaas não credita nada e não cobra taxa.
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'BOLETO', value: 100, dueDate: '2026-01-10' },
    })

    const res = await h.api.call('confirm-cash-receipt', {
      params: { id: created.body.id },
      body: { paymentDate: '2026-01-05', value: 100, notifyCustomer: false },
    })

    expect(res.body.status).toBe('RECEIVED_IN_CASH')
    expect((await ledgerOf(h.accountId)).length).toBe(0) // extrato intocado

    // E dá para desfazer.
    const undone = await h.api.call('undo-cash-receipt-confirmation', {
      params: { id: created.body.id },
    })
    expect(undone.body.status).toBe('PENDING')

    await h.assertLedgerBalances()
  })
})

describe('Estorno', () => {
  it('estorna um Pix recebido e devolve o dinheiro — mas retém a taxa', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'PIX', value: 100, dueDate: '2026-01-10' },
    })
    await h.api.call('confirm-payment', { params: { id: created.body.id } })

    const refunded = await h.api.call('refund-payment', {
      params: { id: created.body.id },
      body: { value: 100, description: 'Cliente desistiu' },
    })
    expect(refunded.body.status).toBe('REFUNDED')

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual([
      'PAYMENT_RECEIVED',
      'PAYMENT_FEE',
      'PAYMENT_REVERSAL',
    ])

    // AS TAXAS NÃO SÃO DEVOLVIDAS. Entrou 100, saiu 1,99 de taxa, e o estorno
    // devolveu os 100 — a conta fica devendo a taxa. É o comportamento real.
    expect(ledger.at(-1)!.balanceCents).toBe(-199)

    await h.assertLedgerBalances()
  })

  it('não é possível estornar cobrança que ninguém pagou', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'PIX', value: 100, dueDate: '2026-01-10' },
    })

    const res = await h.api.call('refund-payment', {
      params: { id: created.body.id },
      body: { value: 100 },
    })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_action')
  })
})

describe('validações que o Asaas faz', () => {
  it('CPF com dígito verificador errado é rejeitado', async () => {
    const res = await h.api.call('create-new-customer', {
      body: { name: 'Fulano', cpfCnpj: '11111111111' },
    })
    expect(res.status).toBe(400)
    // `invalid_object`, e não `invalid_cpfCnpj` — parece errado, mas é o que o
    // sandbox real devolve. Provado pela captura de paridade.
    expect(res.body.errors[0].code).toBe('invalid_object')
  })

  it('cobrança para cliente de outra conta não existe (404, não 403)', async () => {
    const res = await h.api.call('create-new-payment', {
      body: {
        customer: 'cus_000000000000',
        billingType: 'PIX',
        value: 10,
        dueDate: '2026-01-10',
      },
    })
    expect(res.status).toBe(404)
  })

  it('o cliente de uma cobrança nunca muda — o campo nem existe no update', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'PIX', value: 100, dueDate: '2026-01-10' },
    })

    // O schema de update da spec não tem `customer`: mandar o campo não é erro,
    // ele é simplesmente descartado. O que importa é que o cliente não mude.
    const res = await h.api.call('update-existing-payment', {
      params: { id: created.body.id },
      body: {
        customer: 'cus_000000000001',
        billingType: 'PIX',
        value: 50,
        dueDate: '2026-01-10',
      },
    })

    expect(res.status).toBe(200)
    expect(res.body.customer).toBe(cus) // continua o original
    expect(res.body.value).toBe(50) // mas o valor mudou
    expect(res.body.netValue).toBe(48.01) // e a taxa foi recalculada
  })

  it('cobrança paga não pode ser editada', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'PIX', value: 100, dueDate: '2026-01-10' },
    })
    await h.api.call('confirm-payment', { params: { id: created.body.id } })

    const res = await h.api.call('update-existing-payment', {
      params: { id: created.body.id },
      body: { value: 50 },
    })
    expect(res.status).toBe(400)
  })
})
