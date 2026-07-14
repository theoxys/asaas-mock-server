/**
 * Antecipação de recebíveis. (Track D)
 *
 * A cena que importa é a última: o dinheiro entra HOJE e SAI quando o recebível
 * original liquida — e os dois movimentos, somados, deixam na conta exatamente o
 * líquido menos a taxa de antecipação. Se os lançamentos não se cancelarem, o
 * saldo diverge do extrato para sempre, em silêncio.
 *
 * ATENÇÃO: a fórmula da taxa NÃO é documentada pelo Asaas. A nossa está em
 * src/domain/anticipation.ts, registrada em progress.md, e os números vivem em
 * config.fees.anticipation. Estes testes provam a fórmula ESCOLHIDA — não a real.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { financialTransactions } from '../../src/db/schema/index.ts'
import { anticipationHandlers } from '../../src/modules/anticipations/handlers.ts'
import { financeHandlers } from '../../src/modules/finance/handlers.ts'
import { anticipationSettlement } from '../../src/scheduler/jobs/anticipation-jobs.ts'
import { createHarness, createSecondAccount, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

const ledgerOf = async (accountId: string) =>
  h.app.db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.accountId, accountId))

async function customer(): Promise<string> {
  const res = await h.api.call('create-new-customer', {
    body: { name: 'Fulano de Tal', cpfCnpj: '24971563792' },
  })
  return res.body.id
}

/** Uma cobrança de cartão CONFIRMADA: o recebível clássico, com crédito em D+32. */
async function confirmedCreditCard(value = 100): Promise<any> {
  const cus = await customer()
  const created = await h.api.call('create-new-payment', {
    body: { customer: cus, billingType: 'CREDIT_CARD', value, dueDate: '2026-01-10' },
  })
  const confirmed = await h.api.call('confirm-payment', { params: { id: created.body.id } })
  return confirmed.body
}

describe('POST /v3/anticipations/simulate', () => {
  it('cotação de um cartão confirmado: 32 dias, taxa pro-rata sobre o líquido', async () => {
    const payment = await confirmedCreditCard(100)
    expect(payment.estimatedCreditDate).toBe('2026-02-06') // 05/01 + 32

    const res = await h.api.call('simulate-anticipation', { body: { payment: payment.id } })

    expect(res.status).toBe(200)
    expect(res.body.anticipationDays).toBe(32)

    // totalValue = bruto | value = líquido da cobrança (100 − 3,48 de taxa)
    expect(res.body.totalValue).toBe(100)
    expect(res.body.value).toBe(96.52)

    // fee = 96,52 × 2,49% / 30 × 32 = R$ 2,56 (arredondado meio-para-cima)
    expect(res.body.fee).toBe(2.56)
    expect(res.body.netValue).toBe(93.96)

    // Cartão confirmado é dinheiro certo: a operadora já autorizou.
    expect(res.body.isDocumentationRequired).toBe(false)

    // Simular NÃO grava nada.
    const list = await h.api.call('list-anticipations')
    expect(list.body.totalCount).toBe(0)
    await h.assertLedgerBalances()
  })

  it('a simulação e o pedido dão o MESMO número — é a mesma função de cotação', async () => {
    const payment = await confirmedCreditCard(100)

    const simulated = await h.api.call('simulate-anticipation', {
      body: { payment: payment.id },
    })
    const requested = await h.api.call('request-anticipation', {
      body: { payment: payment.id },
    })

    // Se estes dois divergirem, a integração mostra uma taxa na tela e cobra
    // outra. É o defeito mais desonesto que este endpoint pode ter.
    expect(requested.body.fee).toBe(simulated.body.fee)
    expect(requested.body.netValue).toBe(simulated.body.netValue)
    expect(requested.body.anticipationDays).toBe(simulated.body.anticipationDays)
  })
})

describe('POST /v3/anticipations — o dinheiro entra hoje', () => {
  it('credita AGORA, cobra a taxa, e marca a cobrança como antecipada', async () => {
    const payment = await confirmedCreditCard(100)

    // O cartão foi confirmado: o dinheiro NÃO está na conta ainda.
    expect((await h.api.call('retrieve-account-balance')).body.balance).toBe(0)

    const res = await h.api.call('request-anticipation', { body: { payment: payment.id } })

    expect(res.status).toBe(200) // 200, nunca 201
    expect(res.body.status).toBe('CREDITED')
    expect(res.body.payment).toBe(payment.id)
    expect(res.body.dueDate).toBe('2026-02-06')
    expect(res.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/) // UUID puro

    // 96,52 (líquido) − 2,56 (taxa) = 93,96 — hoje, não em D+32.
    const balance = await h.api.call('retrieve-account-balance')
    expect(balance.body.balance).toBe(93.96)

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual([
      'RECEIVABLE_ANTICIPATION_GROSS_CREDIT',
      'RECEIVABLE_ANTICIPATION_FEE',
    ])
    expect(ledger[0]!.valueCents).toBe(9652)
    expect(ledger[1]!.valueCents).toBe(-256)
    expect(ledger[1]!.anticipationId).toBe(res.body.id)
    expect(ledger[1]!.paymentId).toBe(payment.id)

    const p = await h.api.call('retrieve-a-single-payment', { params: { id: payment.id } })
    expect(p.body.anticipated).toBe(true)

    await h.assertLedgerBalances()
  })

  it('o débito acontece quando o recebível original liquida — e o saldo fecha', async () => {
    const payment = await confirmedCreditCard(100)
    await h.api.call('request-anticipation', { body: { payment: payment.id } })

    expect((await h.api.call('retrieve-account-balance')).body.balance).toBe(93.96)

    // D+32: o cartão credita. É a viagem no tempo que o sandbox real não permite.
    await h.advance({ days: 32 })

    const p = await h.api.call('retrieve-a-single-payment', { params: { id: payment.id } })
    expect(p.body.status).toBe('RECEIVED')

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual([
      'RECEIVABLE_ANTICIPATION_GROSS_CREDIT', // +96,52  (hoje)
      'RECEIVABLE_ANTICIPATION_FEE', //          − 2,56  (hoje)
      'PAYMENT_RECEIVED', //                     +100,00 (D+32)
      'PAYMENT_FEE', //                          −  3,48 (D+32)
      'RECEIVABLE_ANTICIPATION_DEBIT', //        − 96,52 (D+32) — já foi adiantado
    ])
    expect(ledger.at(-1)!.valueCents).toBe(-9652)

    // O saldo NÃO dobrou: o adiantamento saiu quando o recebível entrou. Sobrou
    // exatamente o líquido menos a taxa de antecipação.
    const balance = await h.api.call('retrieve-account-balance')
    expect(balance.body.balance).toBe(93.96)

    const a = await h.api.call('list-anticipations')
    expect(a.body.data[0].status).toBe('DEBITED')

    await h.assertLedgerBalances()
  })

  it('a mesma cobrança não pode ser antecipada duas vezes', async () => {
    const payment = await confirmedCreditCard(100)
    await h.api.call('request-anticipation', { body: { payment: payment.id } })

    const res = await h.api.call('request-anticipation', { body: { payment: payment.id } })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_payment')

    await h.assertLedgerBalances()
  })

  it('cobrança Pix não tem recebível a antecipar', async () => {
    const cus = await customer()
    const p = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'PIX', value: 100, dueDate: '2026-01-10' },
    })

    const res = await h.api.call('request-anticipation', { body: { payment: p.body.id } })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].description).toContain('cartão de crédito ou boleto')
  })

  it('cobrança de outra conta não existe (404, não 403)', async () => {
    const payment = await confirmedCreditCard(100)
    const second = await createSecondAccount(h)

    const res = await h
      .as(second.apiKey)
      .call('request-anticipation', { body: { payment: payment.id } })
    expect(res.status).toBe(404)
  })
})

describe('Boleto ainda não pago — antecipação SCHEDULED', () => {
  it('nasce SCHEDULED e só credita quando o pagador paga', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'BOLETO', value: 200, dueDate: '2026-01-20' },
    })

    const a = await h.api.call('request-anticipation', { body: { payment: created.body.id } })

    // O dinheiro do boleto não existe ainda — ninguém pagou. Não se credita o que
    // não entrou.
    expect(a.body.status).toBe('SCHEDULED')
    expect((await h.api.call('retrieve-account-balance')).body.balance).toBe(0)
    expect((await ledgerOf(h.accountId)).length).toBe(0)

    // O pagador paga. O boleto vai a CONFIRMED.
    await h.api.call('confirm-payment', { params: { id: created.body.id } })
    await h.tick()

    const credited = await h.api.call('retrieve-a-single-anticipation', {
      params: { id: a.body.id },
    })
    expect(credited.body.status).toBe('CREDITED')

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual([
      'RECEIVABLE_ANTICIPATION_GROSS_CREDIT',
      'RECEIVABLE_ANTICIPATION_FEE',
    ])

    await h.assertLedgerBalances()
  })

  it('cancelar uma antecipação SCHEDULED devolve a cobrança para o pool', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'BOLETO', value: 200, dueDate: '2026-01-20' },
    })
    const a = await h.api.call('request-anticipation', { body: { payment: created.body.id } })

    const cancelled = await h.api.call('cancel-anticipation', {
      params: { id: a.body.id },
      body: {},
    })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.status).toBe('CANCELLED')

    const p = await h.api.call('retrieve-a-single-payment', { params: { id: created.body.id } })
    expect(p.body.anticipated).toBe(false) // dá para antecipar de novo

    await h.assertLedgerBalances()
  })

  it('antecipação CREDITED não pode ser cancelada — o dinheiro já está na conta', async () => {
    const payment = await confirmedCreditCard(100)
    const a = await h.api.call('request-anticipation', { body: { payment: payment.id } })

    const res = await h.api.call('cancel-anticipation', {
      params: { id: a.body.id },
      body: {},
    })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_action')
  })
})

describe('Limites e antecipação automática', () => {
  it('o limite disponível cai pelo valor já antecipado', async () => {
    const before = await h.api.call('retrieve-anticipation-limits')
    expect(before.body.creditCard.total).toBe(50_000)
    expect(before.body.creditCard.available).toBe(50_000)

    const payment = await confirmedCreditCard(100)
    await h.api.call('request-anticipation', { body: { payment: payment.id } })

    const after = await h.api.call('retrieve-anticipation-limits')
    expect(after.body.creditCard.available).toBe(50_000 - 96.52)
    expect(after.body.bankSlip.available).toBe(50_000) // boleto tem limite próprio
  })

  it('com o flag ligado, o cartão confirmado é antecipado sozinho', async () => {
    const off = await h.api.call('retrieve-status-of-automatic-anticipation')
    expect(off.body.creditCardAutomaticEnabled).toBe(false)

    const on = await h.api.call('update-status-of-automatic-anticipation', {
      body: { creditCardAutomaticEnabled: true },
    })
    expect(on.body.creditCardAutomaticEnabled).toBe(true)

    const payment = await confirmedCreditCard(100)
    await h.tick() // o job antecipa sem ninguém pedir

    const list = await h.api.call('list-anticipations')
    expect(list.body.totalCount).toBe(1)
    expect(list.body.data[0].payment).toBe(payment.id)
    expect(list.body.data[0].status).toBe('CREDITED')

    const balance = await h.api.call('retrieve-account-balance')
    expect(balance.body.balance).toBe(93.96)

    await h.assertLedgerBalances()
  })
})

describe('Webhooks', () => {
  it('CREDITED na antecipação e DEBITED na liquidação do recebível', async () => {
    await h.subscribeWebhook([
      'RECEIVABLE_ANTICIPATION_CREDITED',
      'RECEIVABLE_ANTICIPATION_DEBITED',
    ])

    const payment = await confirmedCreditCard(100)
    await h.api.call('request-anticipation', { body: { payment: payment.id } })
    await h.tick()

    expect(h.sink.eventNames).toEqual(['RECEIVABLE_ANTICIPATION_CREDITED'])

    await h.advance({ days: 32 })

    expect(h.sink.eventNames).toEqual([
      'RECEIVABLE_ANTICIPATION_CREDITED',
      'RECEIVABLE_ANTICIPATION_DEBITED',
    ])

    const debited = h.sink.received.at(-1)!.payload as any
    expect(debited.anticipation.status).toBe('DEBITED')
    expect(debited.anticipation.object).toBe('receivableAnticipation')
  })
})
