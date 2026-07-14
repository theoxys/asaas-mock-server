/**
 * Saldo e extrato. (Track D)
 *
 * O invariante que este arquivo protege é um só, e é o mais caro do projeto:
 *
 *     accounts.balanceCents === SUM(financial_transactions.valueCents)
 *
 * Toda cena termina em `h.assertLedgerBalances()`. Um mock que credita a conta
 * sem lançar no extrato (ou que lança sem creditar) é pior que nenhum mock: o
 * dev fecha a conciliação contra ele, dorme tranquilo, e descobre em produção.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createHarness, createSecondAccount, type Harness } from '../helpers/harness.ts'
import { financeHandlers } from '../../src/modules/finance/handlers.ts'
import { transferHandlers } from '../../src/modules/transfers/handlers.ts'

let h: Harness

beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

async function customer(): Promise<string> {
  const res = await h.api.call('create-new-customer', {
    body: { name: 'Fulano de Tal', cpfCnpj: '24971563792' },
  })
  return res.body.id
}

/** Recebe um Pix de `value` reais. É a forma mais curta de pôr dinheiro na conta. */
async function receivePix(value: number, dueDate = '2026-01-10'): Promise<string> {
  const cus = await customer()
  const created = await h.api.call('create-new-payment', {
    body: { customer: cus, billingType: 'PIX', value, dueDate },
  })
  await h.api.call('confirm-payment', { params: { id: created.body.id } })
  return created.body.id
}

describe('GET /v3/finance/balance', () => {
  it('conta nova tem saldo zero', async () => {
    const res = await h.api.call('retrieve-account-balance')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ balance: 0 })
  })

  it('Pix de R$ 100 recebido → saldo 98,01 (o bruto menos a taxa de R$ 1,99)', async () => {
    await receivePix(100)

    const res = await h.api.call('retrieve-account-balance')

    // SÓ o campo balance. Um campo a mais aqui quebra quem faz destructuring
    // estrito — e o Asaas devolve exatamente isto.
    expect(res.body).toEqual({ balance: 98.01 })

    await h.assertLedgerBalances()
  })
})

describe('GET /v3/financialTransactions — o extrato', () => {
  it('o Pix recebido gera DUAS linhas, e a coluna `balance` acumula', async () => {
    const paymentId = await receivePix(100)

    // `order=asc` EXPLÍCITO: o default do Asaas é `desc` (o mais recente primeiro),
    // capturado do sandbox. Aqui queremos a ordem cronológica, que é a única em que
    // a coluna `balance` faz sentido de cima para baixo — que é o que este teste mede.
    const res = await h.api.call('retrieve-extract', { query: { order: 'asc' } })
    expect(res.status).toBe(200)
    expect(res.body.totalCount).toBe(2)

    const [received, fee] = res.body.data

    expect(received.type).toBe('PAYMENT_RECEIVED')
    expect(received.value).toBe(100)
    expect(received.balance).toBe(100) // saldo DEPOIS desta linha
    expect(received.paymentId).toBe(paymentId)

    expect(fee.type).toBe('PAYMENT_FEE')
    expect(fee.value).toBe(-1.99) // débito é NEGATIVO
    expect(fee.balance).toBe(98.01) // e o saldo final bate com GET /balance
    expect(fee.paymentId).toBe(paymentId)

    // Os campos de correlação existem mesmo vazios — clientes leem todos eles.
    expect(fee.transferId).toBeNull()
    expect(fee.anticipationId).toBeNull()
    expect(fee.splitId).toBeNull()

    await h.assertLedgerBalances()
  })

  /**
   * A ORDEM PADRÃO É `desc`. Capturado do sandbox (tools/probe-pix.ts) — a doc não
   * diz, e nós tínhamos escolhido `asc` por parecer mais lógico.
   *
   * Não é cosmético, e é por isso que vira teste: quem lê `data[0]` para pegar "o
   * último lançamento" — que é o que se faz com um extrato — pegava o PRIMEIRO da
   * vida da conta aqui, e o mais recente no Asaas.
   */
  it('sem `order`, o extrato vem do MAIS RECENTE para o mais antigo', async () => {
    await receivePix(100)

    const res = await h.api.call('retrieve-extract')

    expect(res.body.data[0].type).toBe('PAYMENT_FEE')
    expect(res.body.data[1].type).toBe('PAYMENT_RECEIVED')
  })

  it('`order=desc` inverte o extrato sem embaralhar o saldo de cada linha', async () => {
    await receivePix(100)

    const res = await h.api.call('retrieve-extract', { query: { order: 'desc' } })

    expect(res.body.data.map((t: any) => t.type)).toEqual(['PAYMENT_FEE', 'PAYMENT_RECEIVED'])
    // `balance` continua sendo o saldo NO MOMENTO do lançamento, não a posição.
    expect(res.body.data[0].balance).toBe(98.01)
    expect(res.body.data[1].balance).toBe(100)
  })

  it('filtra por período e pagina', async () => {
    await receivePix(100)

    const inRange = await h.api.call('retrieve-extract', {
      query: { startDate: '2026-01-05', finishDate: '2026-01-05' },
    })
    expect(inRange.body.totalCount).toBe(2)

    const outOfRange = await h.api.call('retrieve-extract', {
      query: { startDate: '2026-02-01' },
    })
    expect(outOfRange.body.totalCount).toBe(0)
    expect(outOfRange.body.data).toEqual([])

    const page = await h.api.call('retrieve-extract', { query: { limit: 1, offset: 0 } })
    expect(page.body.hasMore).toBe(true)
    expect(page.body.limit).toBe(1)
    expect(page.body.data).toHaveLength(1)
  })

  it('data inválida é 400 no formato do Asaas', async () => {
    const res = await h.api.call('retrieve-extract', { query: { startDate: '05/01/2026' } })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_startDate')
  })

  it('o extrato de uma conta NUNCA mostra lançamento de outra', async () => {
    await receivePix(100)
    const second = await createSecondAccount(h)

    const mine = await h.api.call('retrieve-extract')
    expect(mine.body.totalCount).toBe(2)

    const theirs = await h.as(second.apiKey).call('retrieve-extract')
    expect(theirs.body.totalCount).toBe(0)

    const theirBalance = await h.as(second.apiKey).call('retrieve-account-balance')
    expect(theirBalance.body.balance).toBe(0)
  })
})

describe('GET /v3/finance/payment/statistics', () => {
  it('conta e soma as cobranças do filtro — bruto e líquido', async () => {
    const cus = await customer()
    for (const value of [100, 50]) {
      await h.api.call('create-new-payment', {
        body: { customer: cus, billingType: 'PIX', value, dueDate: '2026-01-10' },
      })
    }
    await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'BOLETO', value: 200, dueDate: '2026-01-10' },
    })

    const all = await h.api.call('billing-statistics')
    expect(all.body.quantity).toBe(3)
    expect(all.body.value).toBe(350)
    // 350 − 3 × R$ 1,99 (Pix e boleto têm a mesma taxa fixa)
    expect(all.body.netValue).toBe(344.03)

    const pix = await h.api.call('billing-statistics', { query: { billingType: 'PIX' } })
    expect(pix.body.quantity).toBe(2)
    expect(pix.body.value).toBe(150)

    const paid = await h.api.call('billing-statistics', { query: { status: 'RECEIVED' } })
    expect(paid.body.quantity).toBe(0)
    expect(paid.body.value).toBe(0) // SUM de zero linhas é 0, nunca null
  })
})

describe('GET /v3/finance/split/statistics', () => {
  it('sem split, os dois totais são zero', async () => {
    const res = await h.api.call('retrieve-split-values')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ income: 0, value: 0 })
  })
})
