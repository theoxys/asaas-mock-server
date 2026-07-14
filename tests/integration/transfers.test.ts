/**
 * Transferências. (Track D)
 *
 * O que este arquivo prova, e que o sandbox do Asaas não deixa você provar:
 *
 *   - uma TED pedida hoje cai no PRÓXIMO DIA ÚTIL, e dá para assistir isso
 *     acontecer avançando o relógio um dia;
 *   - uma transferência entre duas contas Asaas move dinheiro DE VERDADE: os dois
 *     extratos fecham, e é isso que separa este projeto de um mock de JSON;
 *   - saldo insuficiente é recusado no ato, com o erro no formato do Asaas.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { financialTransactions } from '../../src/db/schema/index.ts'
import { financeHandlers } from '../../src/modules/finance/handlers.ts'
import { transferHandlers } from '../../src/modules/transfers/handlers.ts'
import { transferSettlement } from '../../src/scheduler/jobs/transfer-jobs.ts'
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

/** Põe dinheiro na conta: um Pix de `value` reais, recebido. */
async function fund(value: number): Promise<void> {
  const cus = await h.api.call('create-new-customer', {
    body: { name: 'Fulano de Tal', cpfCnpj: '24971563792' },
  })
  const p = await h.api.call('create-new-payment', {
    body: { customer: cus.body.id, billingType: 'PIX', value, dueDate: '2026-01-10' },
  })
  await h.api.call('confirm-payment', { params: { id: p.body.id } })
}

const BANK_ACCOUNT = {
  bank: { code: '237' },
  ownerName: 'Fulano de Tal',
  cpfCnpj: '24971563792',
  agency: '1263',
  account: '9999991',
  accountDigit: '1',
  bankAccountType: 'CONTA_CORRENTE',
}

describe('Transferência interna — os DOIS extratos fecham', () => {
  it('debita a origem, credita o destino, e o invariante do ledger se mantém', async () => {
    await fund(500) // saldo: 498,01 (500 − 1,99 de taxa do Pix)
    const second = await createSecondAccount(h)

    const res = await h.api.call('transfer-to-asaas-account', {
      body: { value: 100, walletId: second.walletId },
    })

    expect(res.status).toBe(200) // 200, nunca 201
    expect(res.body.status).toBe('DONE') // interna é instantânea
    expect(res.body.type).toBe('INTERNAL')
    expect(res.body.transferFee).toBe(0) // e gratuita
    expect(res.body.netValue).toBe(100)
    expect(res.body.walletId).toBe(second.walletId)
    // UUID puro, sem prefixo — é assim no Asaas, e não se "padroniza".
    expect(res.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/)

    // Origem: saiu 100.
    const origin = await h.api.call('retrieve-account-balance')
    expect(origin.body.balance).toBe(398.01)

    // Destino: entrou 100. O dinheiro não evaporou.
    const dest = await h.as(second.apiKey).call('retrieve-account-balance')
    expect(dest.body.balance).toBe(100)

    const originLedger = await ledgerOf(h.accountId)
    expect(originLedger.map((l) => l.type)).toEqual([
      'PAYMENT_RECEIVED',
      'PAYMENT_FEE',
      'INTERNAL_TRANSFER_DEBIT',
    ])
    expect(originLedger.at(-1)!.valueCents).toBe(-10_000)

    const destLedger = await ledgerOf(second.accountId)
    expect(destLedger.map((l) => l.type)).toEqual(['INTERNAL_TRANSFER_CREDIT'])
    expect(destLedger[0]!.valueCents).toBe(10_000)
    expect(destLedger[0]!.balanceCents).toBe(10_000)
    expect(destLedger[0]!.transferId).toBe(res.body.id)

    // O invariante, nas DUAS contas.
    await h.assertLedgerBalances()
  })

  it('walletId inexistente → 400, e nada se move', async () => {
    await fund(500)

    const res = await h.api.call('transfer-to-asaas-account', {
      body: { value: 100, walletId: '00000000-0000-4000-8000-000000000000' },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_walletId')

    const balance = await h.api.call('retrieve-account-balance')
    expect(balance.body.balance).toBe(498.01)
    await h.assertLedgerBalances()
  })
})

describe('TED — cobra R$ 5,00 e liquida no próximo dia útil', () => {
  it('nasce PENDING, debita valor + taxa, e só cai no dia seguinte', async () => {
    await fund(500)

    const res = await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 100, bankAccount: BANK_ACCOUNT, operationType: 'TED' },
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('PENDING') // ainda não saiu
    expect(res.body.type).toBe('TED')
    expect(res.body.transferFee).toBe(5) // R$ 5,00
    expect(res.body.netValue).toBe(95)
    expect(res.body.effectiveDate).toBeNull()

    // O saldo já saiu: 498,01 − 100 − 5
    const afterRequest = await h.api.call('retrieve-account-balance')
    expect(afterRequest.body.balance).toBe(393.01)

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual([
      'PAYMENT_RECEIVED',
      'PAYMENT_FEE',
      'TRANSFER',
      'TRANSFER_FEE',
    ])
    expect(ledger.at(-2)!.valueCents).toBe(-10_000)
    expect(ledger.at(-1)!.valueCents).toBe(-500)
    expect(ledger.at(-1)!.transferId).toBe(res.body.id)

    // Um tick no mesmo dia: o banco pegou a TED, mas ela ainda não caiu.
    await h.tick()
    let t = await h.api.call('retrieve-a-single-transfer', { params: { id: res.body.id } })
    expect(t.body.status).toBe('BANK_PROCESSING')
    // 05/01/2026 é segunda → cai na terça, 06/01.
    expect(t.body.effectiveDate).toBe('2026-01-06')

    // O dia seguinte. É a viagem no tempo que o sandbox real não permite.
    await h.advance({ days: 1 })

    t = await h.api.call('retrieve-a-single-transfer', { params: { id: res.body.id } })
    expect(t.body.status).toBe('DONE')
    expect(t.body.transactionReceiptUrl).toContain(t.body.id)

    // Liquidar NÃO gera lançamento novo: o dinheiro já tinha saído na criação.
    expect((await ledgerOf(h.accountId)).length).toBe(4)
    await h.assertLedgerBalances()
  })

  it('a TED de sexta cai na SEGUNDA — o fim de semana não é dia útil', async () => {
    await fund(500)
    await h.advance({ days: 4 }) // 05/01 (seg) → 09/01 (sex)

    const res = await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 100, bankAccount: BANK_ACCOUNT },
    })

    await h.tick()
    const processing = await h.api.call('retrieve-a-single-transfer', {
      params: { id: res.body.id },
    })
    expect(processing.body.effectiveDate).toBe('2026-01-12') // segunda, não sábado

    await h.advance({ days: 2 }) // sábado, domingo
    const weekend = await h.api.call('retrieve-a-single-transfer', {
      params: { id: res.body.id },
    })
    expect(weekend.body.status).toBe('BANK_PROCESSING')

    await h.advance({ days: 1 }) // segunda
    const monday = await h.api.call('retrieve-a-single-transfer', {
      params: { id: res.body.id },
    })
    expect(monday.body.status).toBe('DONE')

    await h.assertLedgerBalances()
  })
})

describe('Pix — gratuito e no mesmo dia', () => {
  it('sai sem taxa e liquida no primeiro tick, com endToEndIdentifier', async () => {
    await fund(500)

    const res = await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 100, pixAddressKey: 'fulano@example.com', pixAddressKeyType: 'EMAIL' },
    })

    expect(res.body.type).toBe('PIX')
    expect(res.body.transferFee).toBe(0) // Pix é gratuito
    expect(res.body.netValue).toBe(100)

    // Só um lançamento: TRANSFER. Taxa zero não vira linha de R$ 0,00 no extrato.
    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual(['PAYMENT_RECEIVED', 'PAYMENT_FEE', 'TRANSFER'])

    await h.tick()

    const t = await h.api.call('retrieve-a-single-transfer', { params: { id: res.body.id } })
    expect(t.body.status).toBe('DONE') // mesmo dia — a rede Pix é 24×7
    expect(t.body.effectiveDate).toBe('2026-01-05')
    expect(t.body.endToEndIdentifier).toMatch(/^E\d{8}20260105/)

    const balance = await h.api.call('retrieve-account-balance')
    expect(balance.body.balance).toBe(398.01)
    await h.assertLedgerBalances()
  })
})

describe('Saldo insuficiente', () => {
  it('é 400 no formato do Asaas — e o extrato continua intocado', async () => {
    await fund(100) // saldo 98,01

    const res = await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 200, bankAccount: BANK_ACCOUNT },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors).toHaveLength(1)
    expect(res.body.errors[0].code).toBe('invalid_value')
    expect(res.body.errors[0].description).toContain('Saldo insuficiente')

    expect((await ledgerOf(h.accountId)).length).toBe(2) // só o Pix recebido
    await h.assertLedgerBalances()
  })

  it('a TAXA entra na conta do saldo: 95 + 5 de TED não cabem em 98,01', async () => {
    await fund(100) // 98,01

    // O valor sozinho caberia. Com a taxa de R$ 5,00, não cabe — e é assim que o
    // Asaas recusa. Ignorar a taxa aqui é o bug clássico deste endpoint.
    const res = await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 95, bankAccount: BANK_ACCOUNT },
    })

    expect(res.status).toBe(400)
    await h.assertLedgerBalances()
  })
})

describe('Cancelamento e agendamento', () => {
  it('cancelar uma transferência PENDING estorna valor E taxa', async () => {
    await fund(500)

    const created = await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 100, bankAccount: BANK_ACCOUNT, scheduleDate: '2026-01-20' },
    })
    expect(created.body.scheduleDate).toBe('2026-01-20')
    expect(created.body.status).toBe('PENDING')

    const cancelled = await h.api.call('cancel-a-transfer', {
      params: { id: created.body.id },
    })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.status).toBe('CANCELLED')

    // Devolveu os 105: o estorno é um lançamento NOVO, não a remoção do débito.
    const ledger = await ledgerOf(h.accountId)
    expect(ledger.at(-1)!.type).toBe('TRANSFER_REVERSAL')
    expect(ledger.at(-1)!.valueCents).toBe(10_500)

    const balance = await h.api.call('retrieve-account-balance')
    expect(balance.body.balance).toBe(498.01) // exatamente o saldo de antes

    await h.assertLedgerBalances()
  })

  it('a transferência agendada NÃO sai antes da data', async () => {
    await fund(500)

    const created = await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 100, pixAddressKey: 'fulano@example.com', scheduleDate: '2026-01-08' },
    })

    await h.advance({ days: 2 }) // 07/01 — ainda não
    let t = await h.api.call('retrieve-a-single-transfer', { params: { id: created.body.id } })
    expect(t.body.status).toBe('PENDING')

    await h.advance({ days: 1 }) // 08/01 — a data chegou
    t = await h.api.call('retrieve-a-single-transfer', { params: { id: created.body.id } })
    expect(t.body.status).toBe('DONE')
    expect(t.body.effectiveDate).toBe('2026-01-08')

    await h.assertLedgerBalances()
  })

  it('transferência já liquidada não pode ser cancelada', async () => {
    await fund(500)
    const created = await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 100, pixAddressKey: 'fulano@example.com' },
    })
    await h.tick() // liquida

    const res = await h.api.call('cancel-a-transfer', { params: { id: created.body.id } })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_action')
  })
})

describe('Falha na instituição de destino', () => {
  it('vai a FAILED e DEVOLVE o dinheiro (TRANSFER_REVERSAL)', async () => {
    await fund(500)

    // TODO(regra): o sandbox do Asaas não documenta como forçar uma falha. Este
    // gatilho é nosso — veja src/modules/transfers/service.ts.
    const created = await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 100, pixAddressKey: 'fail@asaas.com.br' },
    })

    await h.tick()

    const t = await h.api.call('retrieve-a-single-transfer', { params: { id: created.body.id } })
    expect(t.body.status).toBe('FAILED')
    expect(t.body.failReason).toContain('recusada')

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.at(-1)!.type).toBe('TRANSFER_REVERSAL')

    const balance = await h.api.call('retrieve-account-balance')
    expect(balance.body.balance).toBe(498.01) // dinheiro de volta

    await h.assertLedgerBalances()
  })
})

describe('Webhooks', () => {
  it('TED emite CREATED → PENDING → IN_BANK_PROCESSING → DONE, nessa ordem', async () => {
    await h.subscribeWebhook([
      'TRANSFER_CREATED',
      'TRANSFER_PENDING',
      'TRANSFER_IN_BANK_PROCESSING',
      'TRANSFER_DONE',
    ])
    await fund(500)

    await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 100, bankAccount: BANK_ACCOUNT },
    })

    await h.advance({ days: 1 })

    expect(h.sink.eventNames).toEqual([
      'TRANSFER_CREATED',
      'TRANSFER_PENDING',
      'TRANSFER_IN_BANK_PROCESSING',
      'TRANSFER_DONE',
    ])

    // O payload traz o recurso sob a chave `transfer`, congelado no instante do
    // evento.
    const done = h.sink.received.at(-1)!.payload as any
    expect(done.transfer.status).toBe('DONE')
    expect(done.transfer.object).toBe('transfer')
  })
})

describe('Isolamento por conta', () => {
  it('transferência de outra conta é 404, não 403', async () => {
    await fund(500)
    const created = await h.api.call('transfer-to-another-institution-account-or-pix-key', {
      body: { value: 100, pixAddressKey: 'fulano@example.com' },
    })

    const second = await createSecondAccount(h)
    const res = await h
      .as(second.apiKey)
      .call('retrieve-a-single-transfer', { params: { id: created.body.id } })

    expect(res.status).toBe(404)

    const list = await h.as(second.apiKey).call('list-transfers')
    expect(list.body.totalCount).toBe(0)
  })
})
