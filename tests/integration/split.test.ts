/**
 * Split de pagamentos — o dinheiro atravessando a fronteira entre duas contas.
 *
 * O cenário que dá nome a este arquivo: uma cobrança Pix de R$ 100 com split de
 * 30% credita R$ 29,40 no destino — 30% de R$ 98,01 (o netValue), NÃO R$ 30,00.
 * Quem emite a cobrança paga a taxa; o split reparte o que sobrou. É a regra que
 * todo mundo erra, e é a única que este arquivo existe para provar.
 *
 * E, em todo cenário, `assertLedgerBalances()`: os DOIS extratos fecham, ou
 * alguém mexeu em saldo sem passar por `postEntries()`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { accounts, financialTransactions, paymentSplits } from '../../src/db/schema/index.ts'
import { createHarness, createSecondAccount, type Harness } from '../helpers/harness.ts'

let h: Harness
let dest: { accountId: string; walletId: string; apiKey: string }

beforeEach(async () => {
  h = await createHarness()
  dest = await createSecondAccount(h)
})
afterEach(() => h.close())

async function customer(): Promise<string> {
  const res = await h.api.call('create-new-customer', {
    body: { name: 'Fulano de Tal', cpfCnpj: '24971563792' },
  })
  return res.body.id
}

const balanceOf = async (accountId: string): Promise<number> => {
  const [row] = await h.app.db
    .select({ b: accounts.balanceCents })
    .from(accounts)
    .where(eq(accounts.id, accountId))
  return row!.b
}

const ledgerOf = async (accountId: string) =>
  h.app.db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.accountId, accountId))

const splitsOf = async (paymentId: string) =>
  h.app.db.select().from(paymentSplits).where(eq(paymentSplits.paymentId, paymentId))

describe('o split incide sobre o netValue, não sobre o bruto', () => {
  it('Pix de R$ 100 (taxa R$ 1,99) com split de 30% → o destino recebe R$ 29,40', async () => {
    const cus = await customer()

    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: dest.walletId, percentualValue: 30 }],
      },
    })

    expect(created.body.netValue).toBe(98.01) // 100 − 1,99 de taxa
    // 30% de 98,01 = 29,403 → 29,40. NÃO 30,00. É a regra inteira.
    expect(created.body.split[0].totalValue).toBe(29.4)
    expect(created.body.split[0].status).toBe('PENDING')

    // Pagou: o dinheiro entrou na origem, e o split passa a ESPERAR crédito.
    const paid = await h.api.call('confirm-payment', { params: { id: created.body.id } })
    expect(paid.body.status).toBe('RECEIVED')
    expect((await splitsOf(created.body.id))[0]!.status).toBe('AWAITING_CREDIT')

    // Ainda não moveu: quem move é o job.
    expect(await balanceOf(dest.accountId)).toBe(0)
    expect(await balanceOf(h.accountId)).toBe(9801)

    const report = await h.tick()

    expect(report.transitions).toContainEqual({
      resource: 'split',
      id: (await splitsOf(created.body.id))[0]!.id,
      from: 'AWAITING_CREDIT',
      to: 'DONE',
      job: 'split-release',
    })

    // 98,01 − 29,40 = 68,61 na origem | 29,40 no destino
    expect(await balanceOf(h.accountId)).toBe(6861)
    expect(await balanceOf(dest.accountId)).toBe(2940)

    const origin = await ledgerOf(h.accountId)
    expect(origin.map((l) => l.type)).toEqual([
      'PAYMENT_RECEIVED',
      'PAYMENT_FEE',
      'INTERNAL_TRANSFER_DEBIT',
    ])
    expect(origin.at(-1)!.valueCents).toBe(-2940)

    const destination = await ledgerOf(dest.accountId)
    expect(destination.map((l) => l.type)).toEqual(['INTERNAL_TRANSFER_CREDIT'])
    expect(destination[0]!.valueCents).toBe(2940)
    // O lançamento carrega os dois vínculos — sem isso o extrato não se explica.
    expect(destination[0]!.paymentId).toBe(created.body.id)
    expect(destination[0]!.splitId).toBe((await splitsOf(created.body.id))[0]!.id)

    const split = (await splitsOf(created.body.id))[0]!
    expect(split.status).toBe('DONE')
    expect(split.creditDate).toBe('2026-01-05')

    await h.assertLedgerBalances()
  })

  it('fixo + percentual na mesma cobrança: o Asaas simplesmente soma', async () => {
    const other = await createSecondAccount(h, 'Terceira Conta')
    const cus = await customer()

    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [
          { walletId: dest.walletId, fixedValue: 10 },
          { walletId: other.walletId, percentualValue: 25 },
        ],
      },
    })

    // R$ 10,00 fixo | 25% de 98,01 = 24,5025 → R$ 24,50
    expect(created.body.split[0].totalValue).toBe(10)
    expect(created.body.split[1].totalValue).toBe(24.5)

    await h.api.call('confirm-payment', { params: { id: created.body.id } })
    await h.tick()

    expect(await balanceOf(dest.accountId)).toBe(1000)
    expect(await balanceOf(other.accountId)).toBe(2450)
    // 9801 − 1000 − 2450 = 6351
    expect(await balanceOf(h.accountId)).toBe(6351)

    await h.assertLedgerBalances()
  })

  it('o job não credita duas vezes — o CAS vê o split já DONE e não faz nada', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: dest.walletId, percentualValue: 30 }],
      },
    })
    await h.api.call('confirm-payment', { params: { id: created.body.id } })

    await h.tick()
    await h.tick()
    await h.tick()

    expect(await balanceOf(dest.accountId)).toBe(2940) // uma vez, não três
    expect((await ledgerOf(dest.accountId)).length).toBe(1)

    await h.assertLedgerBalances()
  })
})

describe('cartão de crédito — o split só se move em D+32', () => {
  it('a cobrança confirma hoje, mas o dinheiro só troca de conta quando credita', async () => {
    const cus = await customer()

    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: dest.walletId, percentualValue: 50 }],
      },
    })

    // Taxa do cartão à vista: R$ 0,49 + 2,99% = R$ 3,48 → netValue R$ 96,52
    expect(created.body.netValue).toBe(96.52)
    expect(created.body.split[0].totalValue).toBe(48.26) // 50% de 96,52

    const confirmed = await h.api.call('confirm-payment', { params: { id: created.body.id } })
    expect(confirmed.body.status).toBe('CONFIRMED')

    // Split aguardando crédito, mas ninguém tem dinheiro ainda: nem a origem.
    expect((await splitsOf(created.body.id))[0]!.status).toBe('AWAITING_CREDIT')
    expect(await balanceOf(h.accountId)).toBe(0)
    expect(await balanceOf(dest.accountId)).toBe(0)

    await h.advance({ days: 31 })
    expect(await balanceOf(dest.accountId)).toBe(0) // 31 dias: nada.

    // O 32º dia. A cobrança credita e o split sai no MESMO tick — a ordem dos
    // jobs (credit-settlement antes de split-release) é o que garante isso.
    await h.advance({ days: 1 })

    expect(await balanceOf(h.accountId)).toBe(9652 - 4826)
    expect(await balanceOf(dest.accountId)).toBe(4826)
    expect((await splitsOf(created.body.id))[0]!.creditDate).toBe('2026-02-06')

    await h.assertLedgerBalances()
  })
})

describe('divergência de valor — 2 dias úteis para ajustar, ou o split morre', () => {
  it('splits somando mais que o netValue nascem BLOCKED_BY_VALUE_DIVERGENCE', async () => {
    const cus = await customer()

    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        // 60 + 50 = 110 > 98,01
        split: [
          { walletId: dest.walletId, fixedValue: 60 },
          { walletId: (await createSecondAccount(h, 'Quarta')).walletId, fixedValue: 50 },
        ],
      },
    })

    const splits = await splitsOf(created.body.id)
    expect(splits.every((s) => s.status === 'BLOCKED_BY_VALUE_DIVERGENCE')).toBe(true)
    // 05/01/2026 é segunda → 2 dias úteis = quarta, 07/01.
    expect(splits.every((s) => s.blockedUntil === '2026-01-07')).toBe(true)

    // A cobrança em si NÃO é rejeitada — quem fica bloqueado é o split.
    expect(created.status).toBe(200)
    expect(created.body.status).toBe('PENDING')
  })

  it('passado o prazo sem ajuste → CANCELLED com VALUE_DIVERGENCE_BLOCK', async () => {
    await h.subscribeWebhook([
      'PAYMENT_SPLIT_DIVERGENCE_BLOCK',
      'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED',
      'PAYMENT_SPLIT_CANCELLED',
    ])

    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: dest.walletId, fixedValue: 120 }], // > 98,01
      },
    })

    await h.tick()
    expect(h.sink.eventNames).toContain('PAYMENT_SPLIT_DIVERGENCE_BLOCK')

    // Ainda dentro do prazo (07/01 é o último dia).
    await h.advance({ days: 2 })
    expect((await splitsOf(created.body.id))[0]!.status).toBe('BLOCKED_BY_VALUE_DIVERGENCE')

    // 08/01: o prazo passou.
    const [report] = await h.advance({ days: 1 })
    const split = (await splitsOf(created.body.id))[0]!

    expect(split.status).toBe('CANCELLED')
    expect(split.cancellationReason).toBe('VALUE_DIVERGENCE_BLOCK')
    expect(report!.transitions).toContainEqual({
      resource: 'split',
      id: split.id,
      from: 'BLOCKED_BY_VALUE_DIVERGENCE',
      to: 'CANCELLED',
      job: 'split-divergence-expiry',
    })

    await h.tick() // drena a fila de webhook
    expect(h.sink.eventNames).toContain('PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED')
    expect(h.sink.eventNames).toContain('PAYMENT_SPLIT_CANCELLED')

    // Ninguém recebeu nada: o dinheiro nunca saiu da origem.
    expect(await balanceOf(dest.accountId)).toBe(0)
    await h.assertLedgerBalances()
  })

  it('um split bloqueado NÃO vira crédito só porque a cobrança foi paga', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: dest.walletId, fixedValue: 120 }],
      },
    })

    await h.api.call('confirm-payment', { params: { id: created.body.id } })
    await h.tick()

    // Continua bloqueado. O dinheiro fica todo na origem.
    expect((await splitsOf(created.body.id))[0]!.status).toBe('BLOCKED_BY_VALUE_DIVERGENCE')
    expect(await balanceOf(h.accountId)).toBe(9801)
    expect(await balanceOf(dest.accountId)).toBe(0)

    await h.assertLedgerBalances()
  })
})

describe('validações', () => {
  it('split para a própria carteira é rejeitado', async () => {
    const cus = await customer()
    const res = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: h.walletId, percentualValue: 10 }],
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_split')
  })

  it('split sem fixedValue nem percentualValue é rejeitado', async () => {
    const cus = await customer()
    const res = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: dest.walletId }],
      },
    })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_split')
  })
})

describe('carteira externa — não existe conta aqui para creditar', () => {
  it('o split fica DONE, mas nenhum centavo se move', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        // Um walletId que não é de nenhuma conta deste servidor.
        split: [{ walletId: '11111111-2222-3333-4444-555555555555', percentualValue: 30 }],
      },
    })

    await h.api.call('confirm-payment', { params: { id: created.body.id } })
    await h.tick()

    const split = (await splitsOf(created.body.id))[0]!
    expect(split.status).toBe('DONE')
    expect(split.recipientAccountId).toBeNull()

    // DIVERGÊNCIA DELIBERADA com o Asaas real: lá o dinheiro sairia da conta.
    // Aqui não há destino, e debitar sem contrapartida faria o valor sumir do
    // extrato sem que ninguém conseguisse conferir para onde foi.
    expect(await balanceOf(h.accountId)).toBe(9801)

    await h.assertLedgerBalances()
  })
})

describe('estorno — o split que já creditou volta atrás', () => {
  it('estornar a cobrança devolve o dinheiro do destino para a origem', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: dest.walletId, percentualValue: 30 }],
      },
    })

    await h.api.call('confirm-payment', { params: { id: created.body.id } })
    await h.tick()
    expect(await balanceOf(dest.accountId)).toBe(2940)

    await h.api.call('refund-payment', {
      params: { id: created.body.id },
      body: { value: 100 },
    })

    // Sem isto, o destinatário LUCRARIA com o estorno: ficaria com os R$ 29,40
    // de uma cobrança que deixou de existir.
    expect(await balanceOf(dest.accountId)).toBe(0)
    expect((await splitsOf(created.body.id))[0]!.status).toBe('REFUNDED')

    // A origem devolveu os R$ 100 e recuperou os R$ 29,40 do split; a taxa de
    // R$ 1,99 o Asaas retém.
    expect(await balanceOf(h.accountId)).toBe(-199)

    await h.assertLedgerBalances()
  })

  it('cobrança removida cancela o split e emite PAYMENT_SPLIT_CANCELLED', async () => {
    await h.subscribeWebhook(['PAYMENT_SPLIT_CANCELLED'])
    const cus = await customer()

    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'BOLETO',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: dest.walletId, percentualValue: 30 }],
      },
    })

    await h.api.call('delete-payment', { params: { id: created.body.id } })
    await h.tick()

    const split = (await splitsOf(created.body.id))[0]!
    expect(split.status).toBe('CANCELLED')
    expect(split.cancellationReason).toBe('PAYMENT_DELETED')
    expect(h.sink.eventNames).toContain('PAYMENT_SPLIT_CANCELLED')

    await h.assertLedgerBalances()
  })
})

describe('consulta de splits — a mesma linha, duas visões', () => {
  it('paid é o que saiu daqui; received é o que entrou lá', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [
          {
            walletId: dest.walletId,
            percentualValue: 30,
            externalReference: 'parceiro-1',
            description: 'Comissão',
          },
        ],
      },
    })
    await h.api.call('confirm-payment', { params: { id: created.body.id } })
    await h.tick()

    // A conta de origem vê o split como PAGO.
    const paid = await h.api.call('list-paid-splits')
    expect(paid.body.totalCount).toBe(1)
    const s = paid.body.data[0]
    expect(s.walletId).toBe(dest.walletId)
    expect(s.totalValue).toBe(29.4)
    expect(s.percentualValue).toBe(30) // escala 1e4 desfeita
    expect(s.status).toBe('DONE')
    expect(s.originAccountId).toBe(h.accountId)
    expect(s.destinationAccountId).toBe(dest.accountId)
    expect(s.creditDate).toBe('2026-01-05')
    expect(s.externalReference).toBe('parceiro-1')
    expect(s.payment.invoiceNumber).toBe(created.body.invoiceNumber)

    // …e não vê nada como RECEBIDO: ela é a origem, não o destino.
    const nothing = await h.api.call('list-received-splits')
    expect(nothing.body.totalCount).toBe(0)

    // A conta de destino vê exatamente o contrário.
    const dst = h.as(dest.apiKey)
    const received = await dst.call('list-received-splits')
    expect(received.body.totalCount).toBe(1)
    expect(received.body.data[0].id).toBe(s.id)

    expect((await dst.call('list-paid-splits')).body.totalCount).toBe(0)

    // Recuperação individual, das duas pontas.
    const one = await h.api.call('retrieve-a-single-paid-split', { params: { id: s.id } })
    expect(one.body.id).toBe(s.id)

    const two = await dst.call('retrieve-a-single-received-split', { params: { id: s.id } })
    expect(two.body.id).toBe(s.id)

    // O split de outra conta não existe para você — 404, não 403.
    const nope = await dst.call('retrieve-a-single-paid-split', { params: { id: s.id } })
    expect(nope.status).toBe(404)
  })

  it('filtra por paymentId e por status', async () => {
    const cus = await customer()
    const a = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: dest.walletId, percentualValue: 10 }],
      },
    })
    await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        value: 50,
        dueDate: '2026-01-10',
        split: [{ walletId: dest.walletId, percentualValue: 10 }],
      },
    })

    await h.api.call('confirm-payment', { params: { id: a.body.id } })
    await h.tick()

    const byPayment = await h.api.call('list-paid-splits', {
      query: { paymentId: a.body.id },
    })
    expect(byPayment.body.totalCount).toBe(1)

    const done = await h.api.call('list-paid-splits', { query: { status: 'DONE' } })
    expect(done.body.totalCount).toBe(1)
    expect(done.body.data[0].payment.confirmedDate).toBe('2026-01-05')

    const pending = await h.api.call('list-paid-splits', { query: { status: 'PENDING' } })
    expect(pending.body.totalCount).toBe(1)

    await h.assertLedgerBalances()
  })
})
