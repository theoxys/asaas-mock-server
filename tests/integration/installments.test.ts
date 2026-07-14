/**
 * Parcelamento. (Track E)
 *
 * O cenário nº 1 do projeto inteiro — R$ 350,00 em 12x — está aqui. É uma regra
 * de RESTO EXATO ("a sobra vai na última parcela") e é o teste que prova que o
 * dinheiro é inteiro em centavos: em ponto flutuante, a soma das 12 parcelas não
 * fecha em 350,00.
 *
 * E o D+32 do cartão, parcela a parcela: é o que o sandbox do Asaas não deixa
 * você testar sem esperar um mês.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { financialTransactions, paymentSplits } from '../../src/db/schema/index.ts'
import { createHarness, createSecondAccount, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

async function customer(): Promise<string> {
  const res = await h.api.call('create-new-customer', {
    body: { name: 'Fulano de Tal', cpfCnpj: '24971563792' },
  })
  expect(res.status).toBe(200)
  return res.body.id
}

const parcels = async (installmentId: string) => {
  const res = await h.api.call('list-payments-of-a-installment', {
    params: { id: installmentId },
    query: { limit: 100 },
  })
  expect(res.status).toBe(200)
  return res.body.data as any[]
}

const ledgerOf = async (accountId: string) =>
  h.app.db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.accountId, accountId))

describe('R$ 350,00 em 12x — a sobra vai na ÚLTIMA parcela', () => {
  it('cria as 12 cobranças NA HORA, e a soma fecha exatamente em 350,00', async () => {
    const cus = await customer()

    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'BOLETO',
        installmentCount: 12,
        totalValue: 350,
        dueDate: '2026-02-05',
        description: 'Pedido 056984',
      },
    })

    expect(created.status).toBe(200) // 200, nunca 201
    expect(created.body.object).toBe('installment')
    // O id do parcelamento é UUID PURO — sem prefixo. É de propósito.
    expect(created.body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.body.installmentCount).toBe(12)
    expect(created.body.value).toBe(350) // o TOTAL
    // O Asaas reporta em `paymentValue` o valor da ÚLTIMA parcela — a que leva a
    // sobra do arredondamento. Contraintuitivo, e provado contra o sandbox real.
    expect(created.body.paymentValue).toBe(29.24)
    expect(created.body.expirationDay).toBe(5)

    // Ao contrário da assinatura, as cobranças existem TODAS desde já.
    const list = await parcels(created.body.id)
    expect(list.length).toBe(12)

    const values = list.map((p) => p.value)
    expect(values).toEqual([
      29.16, 29.16, 29.16, 29.16, 29.16, 29.16, 29.16, 29.16, 29.16, 29.16, 29.16,
      // a sobra do arredondamento vai na ÚLTIMA: 350 − 11 × 29,16 = 29,24
      29.24,
    ])

    // A soma tem que ser EXATA. Somamos em centavos — em reais, 11 × 29.16 não
    // fecha em binário e a asserção passaria a depender de epsilon.
    const totalCents = values.reduce((a, v) => a + Math.round(v * 100), 0)
    expect(totalCents).toBe(35_000)

    // Vencimentos mensais a partir do primeiro.
    expect(list.map((p) => p.dueDate)).toEqual([
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
      '2026-05-05',
      '2026-06-05',
      '2026-07-05',
      '2026-08-05',
      '2026-09-05',
      '2026-10-05',
      '2026-11-05',
      '2026-12-05',
      '2027-01-05',
    ])

    // Toda parcela aponta para o parcelamento e sabe o próprio número.
    expect(list.map((p) => p.installmentNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
    expect(new Set(list.map((p) => p.installment))).toEqual(new Set([created.body.id]))
  })

  it('`value` (valor da parcela) e `totalValue` (total) são caminhos diferentes', async () => {
    const cus = await customer()

    // value = valor POR PARCELA → total = 3 × 100 = 300
    const porParcela = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 3,
        value: 100,
        dueDate: '2026-02-05',
      },
    })
    expect(porParcela.body.value).toBe(300)
    expect(porParcela.body.paymentValue).toBe(100)

    // totalValue = total A DIVIDIR → parcela = 100/3 = 33,33 (sobra na última)
    const total = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 3,
        totalValue: 100,
        dueDate: '2026-02-05',
      },
    })
    expect(total.body.value).toBe(100)
    expect((await parcels(total.body.id)).map((p) => p.value)).toEqual([33.33, 33.33, 33.34])
  })

  it('sem value nem totalValue, o Asaas recusa', async () => {
    const cus = await customer()
    const res = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 3,
        dueDate: '2026-02-05',
      },
    })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_value')
  })
})

describe('Parcelamento no cartão — cada parcela credita em D+32', () => {
  it('a taxa é a da FAIXA de 12x, e o dinheiro só aparece 32 dias depois', async () => {
    const cus = await customer()

    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        installmentCount: 12,
        totalValue: 350,
        dueDate: '2026-02-05',
      },
    })

    const list = await parcels(created.body.id)
    const first = list[0]!

    /**
     * A taxa do cartão parcelado NÃO se calcula sobre a parcela — este teste
     * afirmava que sim (0,49 + 3,99% de cada parcela = R$ 1,65 → líquido 27,51)
     * e estava errado. A captura contra o sandbox provou o contrário:
     *
     *   o Asaas cobra `0,49 + pct% × TOTAL` UMA vez e divide entre as parcelas.
     *   12x de R$ 350: 0,49 + 3,99% × 350 = R$ 14,455 → 1446 centavos.
     *
     * E a divisão TRUNCA: 1446/12 = 120,5. Arredondando dá 121 (líquido 27,95);
     * truncando dá 120 (líquido 27,96). Este teste afirmava 27,95 — e ERRAVA UM
     * CENTAVO POR PARCELA. O sandbox real devolve netValue 27,96 sobre uma
     * parcela de 29,16. Nenhum outro caso da suíte separava as duas regras, e é
     * por isso que o erro sobreviveu: em 300/3x e 600/6x, round e trunc coincidem.
     */
    expect(first.value).toBe(29.16)
    expect(first.netValue).toBe(27.96)

    const confirmed = await h.api.call('confirm-payment', { params: { id: first.id } })
    expect(confirmed.body.status).toBe('CONFIRMED')
    // Parcela #1 → D+32×1 da confirmação (05/01), rolado para dia útil.
    expect(confirmed.body.estimatedCreditDate).toBe('2026-02-06')

    // Confirmada, mas o dinheiro NÃO está na conta.
    expect((await ledgerOf(h.accountId)).length).toBe(0)

    await h.advance({ days: 31 })
    let p = await h.api.call('retrieve-a-single-payment', { params: { id: first.id } })
    expect(p.body.status).toBe('CONFIRMED')

    // O 32º dia.
    const [report] = await h.advance({ days: 1 })
    expect(report!.transitions).toContainEqual({
      resource: 'payment',
      id: first.id,
      from: 'CONFIRMED',
      to: 'RECEIVED',
      job: 'credit-settlement',
    })

    p = await h.api.call('retrieve-a-single-payment', { params: { id: first.id } })
    expect(p.body.status).toBe('RECEIVED')
    expect(p.body.creditDate).toBe('2026-02-06')

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual(['PAYMENT_RECEIVED', 'PAYMENT_FEE'])
    expect(ledger[0]!.valueCents).toBe(2916) // bruto da parcela
    // A taxa sai do TOTAL (0,49 + 3,99% × 350 = 1446 centavos) dividida por 12,
    // TRUNCANDO → R$ 1,20 por parcela. Não 0,49 + 3,99% DA PARCELA (R$ 1,65), e
    // não R$ 1,21 (que é 1446/12 arredondado). Os dois erros já moraram aqui.
    expect(ledger[1]!.valueCents).toBe(-120)
    expect(ledger[1]!.balanceCents).toBe(2796)

    // As outras 11 continuam esperando — cada uma creditará no seu D+32.
    const rest = (await parcels(created.body.id)).filter((x) => x.id !== first.id)
    expect(rest.every((x) => x.status === 'PENDING')).toBe(true)

    await h.assertLedgerBalances()
  })
})

describe('Split no parcelamento — fixedValue vs totalFixedValue', () => {
  it('`fixedValue` é aplicado EM CADA parcela', async () => {
    const other = await createSecondAccount(h)
    const cus = await customer()

    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 3,
        value: 100,
        dueDate: '2026-02-05',
        splits: [{ walletId: other.walletId, fixedValue: 10 }],
      },
    })

    const list = await parcels(created.body.id)
    // R$ 10 em CADA uma das 3 parcelas — R$ 30 no total, não R$ 10.
    for (const p of list) {
      expect(p.split.length).toBe(1)
      expect(p.split[0].fixedValue).toBe(10)
      expect(p.split[0].totalValue).toBe(10)
    }
  })

  it('`totalFixedValue` é DIVIDIDO entre as parcelas, com a sobra na última', async () => {
    const other = await createSecondAccount(h)
    const cus = await customer()

    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 3,
        totalValue: 300,
        dueDate: '2026-02-05',
        splits: [{ walletId: other.walletId, totalFixedValue: 100 }],
      },
    })

    // R$ 100 divididos em 3 → 33,33 | 33,33 | 33,34. A MESMA regra do valor das
    // parcelas. `fixedValue` seria R$ 100 em cada uma — R$ 300 no total.
    const list = await parcels(created.body.id)
    expect(list.map((p) => p.split[0].totalValue)).toEqual([33.33, 33.33, 33.34])

    const soma = list.reduce((a, p) => a + Math.round(p.split[0].totalValue * 100), 0)
    expect(soma).toBe(10_000)
  })

  it('totalFixedValue junto com installmentNumber é recusado', async () => {
    const other = await createSecondAccount(h)
    const cus = await customer()

    const res = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 3,
        value: 100,
        dueDate: '2026-02-05',
        splits: [
          { walletId: other.walletId, totalFixedValue: 100, installmentNumber: 2 },
        ],
      },
    })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_split')
  })

  it('update-installment-splits reescreve o split das parcelas em aberto', async () => {
    const other = await createSecondAccount(h)
    const cus = await customer()

    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 3,
        value: 100,
        dueDate: '2026-02-05',
        splits: [{ walletId: other.walletId, fixedValue: 10 }],
      },
    })

    const res = await h.api.call('update-installment-splits', {
      params: { id: created.body.id },
      body: { splits: [{ walletId: other.walletId, percentualValue: 20 }] },
    })

    expect(res.status).toBe(200)
    expect(res.body.splits.length).toBe(3) // uma entrada por parcela em aberto

    // 20% do NETVALUE (R$ 100 − R$ 1,99 do Pix = R$ 98,01) → R$ 19,60.
    // Sobre o bruto daria R$ 20,00. O split incide sobre o líquido, e é o erro
    // que todo mundo comete.
    const list = await parcels(created.body.id)
    for (const p of list) {
      expect(p.split.length).toBe(1)
      expect(p.split[0].percentualValue).toBe(20)
      expect(p.split[0].totalValue).toBe(19.6)
    }
  })
})

describe('Remover, cancelar e estornar', () => {
  it('remover o parcelamento remove as parcelas em aberto', async () => {
    const cus = await customer()
    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 3,
        value: 100,
        dueDate: '2026-02-05',
      },
    })

    const list = await parcels(created.body.id)
    // A 1ª é paga — dinheiro que entrou não se apaga.
    await h.api.call('confirm-payment', { params: { id: list[0]!.id } })

    const removed = await h.api.call('remove-installment', {
      params: { id: created.body.id },
    })
    expect(removed.status).toBe(200)
    expect(removed.body.deleted).toBe(true)

    const p2 = await h.api.call('retrieve-a-single-payment', { params: { id: list[1]!.id } })
    expect(p2.body.deleted).toBe(true)

    const p1 = await h.api.call('retrieve-a-single-payment', { params: { id: list[0]!.id } })
    expect(p1.body.deleted).toBe(false) // a paga continua
    expect(p1.body.status).toBe('RECEIVED')

    // Removido, some da listagem.
    const all = await h.api.call('list-installments', {})
    expect(all.body.data.map((i: any) => i.id)).not.toContain(created.body.id)

    await h.assertLedgerBalances()
  })

  it('cancelar as cobranças mantém o parcelamento e devolve as removidas', async () => {
    const cus = await customer()
    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 3,
        value: 100,
        dueDate: '2026-02-05',
      },
    })

    const res = await h.api.call('cancel-charges-of-an-installment', {
      params: { id: created.body.id },
    })

    expect(res.status).toBe(200)
    expect(res.body.deletedPayments.length).toBe(3)
    expect(res.body.deletedPayments.every((p: any) => p.deleted)).toBe(true)

    // O PARCELAMENTO continua — é a diferença para o remove.
    const still = await h.api.call('retrieve-a-single-installment', {
      params: { id: created.body.id },
    })
    expect(still.status).toBe(200)
    expect(still.body.deleted).toBe(false)
  })

  it('estornar devolve o dinheiro de todas as parcelas pagas — e retém as taxas', async () => {
    const cus = await customer()
    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 2,
        value: 100,
        dueDate: '2026-02-05',
      },
    })

    const list = await parcels(created.body.id)
    for (const p of list) {
      await h.api.call('confirm-payment', { params: { id: p.id } })
    }

    const refunded = await h.api.call('refund-installment', {
      params: { id: created.body.id },
      body: { value: 200 },
    })
    expect(refunded.status).toBe(200)
    expect(refunded.body.refunds.length).toBe(2)

    const after = await parcels(created.body.id)
    expect(after.every((p) => p.status === 'REFUNDED')).toBe(true)

    /**
     * AS TAXAS NÃO SÃO DEVOLVIDAS. Entraram R$ 200, saíram R$ 3,98 de taxa, e o
     * estorno devolveu os R$ 200 — a conta fica devendo as taxas.
     */
    const ledger = await ledgerOf(h.accountId)
    expect(ledger.at(-1)!.balanceCents).toBe(-398)

    await h.assertLedgerBalances()
  })

  it('estorno parcial de parcelamento é recusado explicitamente (TODO(regra))', async () => {
    const cus = await customer()
    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 2,
        value: 100,
        dueDate: '2026-02-05',
      },
    })

    const list = await parcels(created.body.id)
    await h.api.call('confirm-payment', { params: { id: list[0]!.id } })

    // Recusar é melhor que inventar uma regra de rateio e produzir valores
    // errados com cara de certos.
    const res = await h.api.call('refund-installment', {
      params: { id: created.body.id },
      body: { value: 50 },
    })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_value')
  })
})

describe('Carnê e isolamento por conta', () => {
  it('o carnê é um PDF de verdade, não um JSON com uma URL', async () => {
    const cus = await customer()
    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'BOLETO',
        installmentCount: 3,
        value: 100,
        dueDate: '2026-02-05',
      },
    })

    // Direto no servidor: o ApiClient do harness faz JSON.parse, e um PDF não é
    // JSON. É justamente o ponto — a resposta 200 desta operação não tem schema.
    const res = await h.app.app.handle(
      new Request(`http://localhost/v3/installments/${created.body.id}/paymentBook`, {
        headers: { access_token: '$aact_hmlg_test0000000000000000000000000' },
      }),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/pdf')

    const body = await res.text()
    expect(body.startsWith('%PDF-1.4')).toBe(true)
    expect(body).toContain('Parcela 1/3')
    expect(body).toContain('%%EOF')
  })

  it('parcelamento de outra conta não existe (404, não 403)', async () => {
    const other = await createSecondAccount(h)
    const cus = await customer()

    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 2,
        value: 100,
        dueDate: '2026-02-05',
      },
    })

    const res = await h.as(other.apiKey).call('retrieve-a-single-installment', {
      params: { id: created.body.id },
    })
    expect(res.status).toBe(404)
  })
})

describe('a parcela é uma cobrança como qualquer outra', () => {
  it('nasce de createPayment: mesmo formato, mesmos webhooks, mesmo split', async () => {
    await h.subscribeWebhook(['PAYMENT_CREATED'])
    const cus = await customer()

    const created = await h.api.call('create-installment', {
      body: {
        customer: cus,
        billingType: 'PIX',
        installmentCount: 3,
        value: 100,
        dueDate: '2026-02-05',
      },
    })

    await h.tick() // o dispatcher roda no tick

    // Uma cobrança criada = um PAYMENT_CREATED. Três parcelas, três eventos.
    expect(h.sink.eventNames.filter((e) => e === 'PAYMENT_CREATED').length).toBe(3)

    const splits = await h.app.db.select().from(paymentSplits)
    expect(splits.length).toBe(0) // sem split configurado, nenhuma linha
    void created
  })
})

describe('Parcelamento no cartão', () => {
  const CARD = {
    creditCard: {
      holderName: 'Fulano de Tal',
      number: '4444444444444444', // cartão de teste que APROVA
      expiryMonth: '12',
      expiryYear: '2030',
      ccv: '123',
    },
    creditCardHolderInfo: {
      name: 'Fulano de Tal',
      email: 'fulano@localhost',
      cpfCnpj: '24971563792',
      postalCode: '01310-100',
      addressNumber: '1',
      phone: '11999998888',
    },
    remoteIp: '127.0.0.1',
  }

  /**
   * Regressão de uma falha silenciosa: `POST /v3/installments` divide rota com a
   * variante "com cartão", e o handler ignorava o cartão. As 12 parcelas nasciam
   * PENDING — o cartão nunca era cobrado, e ninguém via erro nenhum.
   *
   * No cartão, a emissora autoriza o total de uma vez: as N parcelas já nascem
   * CONFIRMED, e é o cliente que paga em N vezes.
   */
  it('cobra o cartão e as 12 parcelas nascem CONFIRMED', async () => {
    const res = await h.api.call('create-installment', {
      body: {
        customer: await customer(),
        billingType: 'CREDIT_CARD',
        installmentCount: 12,
        totalValue: 350,
        dueDate: '2026-02-05',
        ...CARD,
      },
    })
    expect(res.status).toBe(200)

    const list = await h.api.call('list-payments-of-a-installment', {
      params: { id: res.body.id },
      query: { limit: 100 },
    })

    expect(list.body.data).toHaveLength(12)
    for (const p of list.body.data) expect(p.status).toBe('CONFIRMED')

    // A regra do resto continua valendo — o cartão não a altera.
    const values = list.body.data.map((p: any) => p.value)
    expect(values.slice(0, 11)).toEqual(Array(11).fill(29.16))
    expect(values[11]).toBe(29.24)
  })

  it('cartão recusado → 400, e NENHUM parcelamento fica para trás', async () => {
    const before = await h.api.call('list-installments', {})

    const res = await h.api.call('create-installment', {
      body: {
        customer: await customer(),
        billingType: 'CREDIT_CARD',
        installmentCount: 3,
        totalValue: 300,
        dueDate: '2026-02-05',
        ...CARD,
        creditCard: { ...CARD.creditCard, number: '5184019740373151' }, // recusa
      },
    })

    expect(res.status).toBe(400)

    // O ponto: a validação acontece ANTES de qualquer escrita.
    const after = await h.api.call('list-installments', {})
    expect(after.body.totalCount).toBe(before.body.totalCount)
  })
})
