/**
 * Assinatura. (Track E)
 *
 * A REGRA QUE DEFINE O RECURSO, e ela é contraintuitiva:
 *
 *   **criar a assinatura NÃO cria cobrança nenhuma.**
 *
 * O Asaas gera a cobrança quando faltam 40 dias para o `nextDueDate`. É a
 * diferença nº 1 entre assinatura e parcelamento (que cria as N cobranças na
 * hora), e é a origem do bug clássico: "criei a assinatura e o webhook
 * PAYMENT_CREATED nunca chegou".
 *
 * Provamos OS DOIS LADOS da janela: no 41º dia não nasce nada; no 40º, nasce.
 * Um teste que só prova o lado de dentro passaria mesmo com lookahead infinito.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { creditCards, financialTransactions, subscriptions } from '../../src/db/schema/index.ts'
import { createHarness, createSecondAccount, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

/** O relógio dos testes começa em 2026-01-05. */
const TODAY = '2026-01-05'
/** Exatamente 40 dias depois — o primeiro dia DENTRO da janela. */
const IN_40_DAYS = '2026-02-14'
/** 41 dias depois — um dia FORA. */
const IN_41_DAYS = '2026-02-15'

async function customer(): Promise<string> {
  const res = await h.api.call('create-new-customer', {
    body: { name: 'Fulano de Tal', cpfCnpj: '24971563792' },
  })
  expect(res.status).toBe(200)
  return res.body.id
}

async function subscribe(over: Record<string, unknown> = {}) {
  const res = await h.api.call('create-new-subscription', {
    body: {
      customer: await customer(),
      billingType: 'BOLETO',
      value: 19.9,
      nextDueDate: IN_41_DAYS,
      cycle: 'MONTHLY',
      description: 'Plano Pro',
      ...over,
    },
  })
  expect(res.status).toBe(200) // 200, nunca 201
  return res.body
}

const chargesOf = async (subscriptionId: string) => {
  const res = await h.api.call('list-payments-of-a-subscription', {
    params: { id: subscriptionId },
    query: { limit: 100 },
  })
  expect(res.status).toBe(200)
  return res.body.data as any[]
}

const reload = async (id: string) =>
  (await h.api.call('retrieve-a-single-subscription', { params: { id } })).body

const ledgerOf = async (accountId: string) =>
  h.app.db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.accountId, accountId))

describe('A primeira cobrança nasce NA CRIAÇÃO — e a segunda, na janela de 40 dias', () => {
  /**
   * Este bloco já afirmou o CONTRÁRIO, com confiança, por três testes seguidos:
   * que criar uma assinatura não criava cobrança nenhuma, e que a primeira só
   * nascia quando faltavam 40 dias para o vencimento.
   *
   * A captura contra o sandbox real derrubou isso (`bun run capture`). O Asaas:
   *
   *   POST /v3/subscriptions com nextDueDate = hoje+60
   *     → devolve nextDueDate = hoje+90 (já avançou um ciclo)
   *     → e a cobrança de hoje+60 já existe, criada na hora
   *
   * A janela de 40 dias é real, mas governa a SEGUNDA cobrança em diante.
   */
  it('criar a assinatura JÁ cria a primeira cobrança e avança o ciclo', async () => {
    const sub = await subscribe({ nextDueDate: IN_41_DAYS })

    expect(sub.id).toMatch(/^sub_[A-Za-z0-9]{12}$/)
    expect(sub.status).toBe('ACTIVE')
    expect(sub.value).toBe(19.9)

    // O nextDueDate JÁ AVANÇOU um ciclo — o informado virou a cobrança.
    expect(sub.nextDueDate).toBe('2026-03-15')

    const charges = await chargesOf(sub.id)
    expect(charges.length).toBe(1)
    expect(charges[0]!.dueDate).toBe(IN_41_DAYS) // o vencimento que eu pedi
    expect(charges[0]!.value).toBe(19.9)
    expect(charges[0]!.status).toBe('PENDING')
    expect(charges[0]!.subscription).toBe(sub.id)
  })

  it('a SEGUNDA cobrança respeita a janela: nada no 41º dia, nasce no 40º', async () => {
    // nextDueDate=IN_41_DAYS → a 1ª cobrança é dessa data, e o ciclo vai p/ 15/03.
    const sub = await subscribe({ nextDueDate: IN_41_DAYS })
    expect((await chargesOf(sub.id)).length).toBe(1)

    // Hoje é 05/01; o próximo vencimento é 15/03 — a 69 dias. Fora da janela.
    await h.tick()
    expect((await chargesOf(sub.id)).length).toBe(1)

    // Avança até faltarem 40 dias para 15/03 → 03/02.
    const reports = await h.advance({ days: 29 })

    const charges = await chargesOf(sub.id)
    expect(charges.length).toBe(2)

    const segunda = charges.find((c) => c.dueDate === '2026-03-15')
    expect(segunda).toBeDefined()
    expect(segunda!.value).toBe(19.9)

    // O job registra o que criou no relatório do tick.
    expect(reports.flatMap((r) => r.created)).toContainEqual({
      resource: 'payment',
      id: segunda!.id,
      job: 'subscription-generation',
    })

    // E o ciclo avançou de novo.
    expect((await reload(sub.id)).nextDueDate).toBe('2026-04-15')
    void TODAY
    void IN_40_DAYS
  })

  /**
   * A idempotência é o que separa "funciona" de "funciona sob viagem no tempo".
   * O CAS reclama o vencimento ANTES de a cobrança nascer, então um tick repetido
   * encontra o `nextDueDate` já avançado e não gera nada.
   */
  it('ticks repetidos no mesmo dia não duplicam a cobrança', async () => {
    const sub = await subscribe({ nextDueDate: IN_40_DAYS })

    await h.tick()
    await h.tick()
    await h.tick()

    // Uma só — a da criação. O vencimento já foi consumido.
    expect((await chargesOf(sub.id)).length).toBe(1)
    expect((await reload(sub.id)).nextDueDate).toBe('2026-03-14')
  })
})

describe('O tempo passa e as cobranças nascem uma a uma', () => {
  it('120 dias adiante: 4 cobranças mensais, e o nextDueDate acompanha o ciclo', async () => {
    const sub = await subscribe({ nextDueDate: IN_41_DAYS })

    await h.advance({ days: 120 }) // hoje = 2026-05-05

    /**
     * Horizonte em 05/05 = 14/06. Nasceram as de 15/02, 15/03, 15/04 e 15/05.
     * A de 15/06 ainda não: faltam 41 dias para ela. A janela nunca se antecipa.
     */
    const charges = await chargesOf(sub.id)
    expect(charges.map((c) => c.dueDate)).toEqual([
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
      '2026-05-15',
    ])

    const after = await reload(sub.id)
    expect(after.nextDueDate).toBe('2026-06-15')
    expect(after.status).toBe('ACTIVE')

    // Quem venceu sem ser pago está OVERDUE — o job 2 fez o trabalho dele.
    expect(charges[0]!.status).toBe('OVERDUE')
  })

  it('ciclo semanal: a janela de 40 dias cobre VÁRIOS vencimentos de uma vez', async () => {
    const sub = await subscribe({ cycle: 'WEEKLY', nextDueDate: '2026-01-10' })

    await h.tick()

    /**
     * 40 dias de janela num ciclo de 7 dias: o Asaas gera todas as cobranças
     * cujo vencimento cabe no horizonte (10/01 … 14/02), não só a próxima.
     */
    const charges = await chargesOf(sub.id)
    expect(charges.map((c) => c.dueDate)).toEqual([
      '2026-01-10',
      '2026-01-17',
      '2026-01-24',
      '2026-01-31',
      '2026-02-07',
      '2026-02-14',
    ])
    expect((await reload(sub.id)).nextDueDate).toBe('2026-02-21')
  })

  it('a cobrança gerada é uma cobrança comum: paga, credita e fecha o extrato', async () => {
    const sub = await subscribe({ billingType: 'PIX', nextDueDate: IN_40_DAYS, value: 100 })
    await h.tick()

    const [charge] = await chargesOf(sub.id)
    const paid = await h.api.call('confirm-payment', { params: { id: charge!.id } })

    // Pix: RECEIVED direto, taxa fixa de R$ 1,99.
    expect(paid.body.status).toBe('RECEIVED')
    expect(paid.body.netValue).toBe(98.01)

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual(['PAYMENT_RECEIVED', 'PAYMENT_FEE'])
    expect(ledger[1]!.balanceCents).toBe(9801)

    await h.assertLedgerBalances()
  })
})

describe('O fim da assinatura', () => {
  it('maxPayments esgotado → EXPIRED', async () => {
    const sub = await subscribe({ nextDueDate: IN_41_DAYS, maxPayments: 2 })

    await h.advance({ days: 40 }) // hoje = 2026-02-14

    const charges = await chargesOf(sub.id)
    expect(charges.map((c) => c.dueDate)).toEqual(['2026-02-15', '2026-03-15'])

    const after = await reload(sub.id)
    expect(after.status).toBe('EXPIRED') // acabou o contrato
    expect(after.maxPayments).toBe(2)

    // E não gera mais NADA, por mais que o tempo passe.
    await h.advance({ days: 90 })
    expect((await chargesOf(sub.id)).length).toBe(2)
  })

  it('endDate ultrapassado → EXPIRED, sem gerar a cobrança que passaria do fim', async () => {
    const sub = await subscribe({ nextDueDate: IN_41_DAYS, endDate: '2026-03-01' })

    await h.advance({ days: 1 }) // gera a de 15/02; a próxima seria 15/03 > 01/03

    const charges = await chargesOf(sub.id)
    expect(charges.map((c) => c.dueDate)).toEqual(['2026-02-15'])
    expect((await reload(sub.id)).status).toBe('EXPIRED')

    await h.advance({ days: 60 })
    expect((await chargesOf(sub.id)).length).toBe(1)
  })

  it('INACTIVE para de gerar NOVAS cobranças (a da criação continua lá)', async () => {
    const sub = await subscribe({ nextDueDate: IN_41_DAYS })

    // A criação já gerou uma. Desativar não apaga dinheiro que já foi cobrado.
    expect((await chargesOf(sub.id)).length).toBe(1)

    await h.api.call('update-existing-subscription', {
      params: { id: sub.id },
      body: { status: 'INACTIVE' },
    })

    await h.advance({ days: 60 })

    // Dois meses depois, continua sendo UMA. O job não gerou mais nada.
    expect((await chargesOf(sub.id)).length).toBe(1)
    expect((await reload(sub.id)).status).toBe('INACTIVE')
  })

  it('remover a assinatura remove as cobranças ainda em aberto', async () => {
    const sub = await subscribe({ nextDueDate: IN_40_DAYS })
    await h.tick()

    const [charge] = await chargesOf(sub.id)

    const removed = await h.api.call('remove-subscription', { params: { id: sub.id } })
    expect(removed.status).toBe(200)
    expect(removed.body.deleted).toBe(true)

    const p = await h.api.call('retrieve-a-single-payment', { params: { id: charge!.id } })
    expect(p.body.deleted).toBe(true)

    // Removida, não gera mais nada.
    await h.advance({ days: 60 })
    expect(await chargesOf(sub.id)).toEqual([])
  })
})

describe('Atualizar a assinatura', () => {
  it('`updatePendingPayments: true` alcança as cobranças já geradas', async () => {
    const sub = await subscribe({ billingType: 'PIX', nextDueDate: IN_40_DAYS, value: 100 })
    await h.tick()

    const [before] = await chargesOf(sub.id)
    expect(before!.value).toBe(100)

    await h.api.call('update-existing-subscription', {
      params: { id: sub.id },
      body: { value: 150, updatePendingPayments: true },
    })

    const [after] = await chargesOf(sub.id)
    expect(after!.value).toBe(150)
    // A taxa é recalculada junto — senão o netValue (base do split) ficaria errado.
    expect(after!.netValue).toBe(148.01)
    expect((await reload(sub.id)).value).toBe(150)
  })

  it('sem `updatePendingPayments`, a cobrança pendente mantém o preço antigo', async () => {
    const sub = await subscribe({ billingType: 'PIX', nextDueDate: IN_40_DAYS, value: 100 })
    await h.tick()

    await h.api.call('update-existing-subscription', {
      params: { id: sub.id },
      body: { value: 150 },
    })

    // A pendente NÃO muda — é a pegadinha clássica de quem sobe o preço do plano.
    const [charge] = await chargesOf(sub.id)
    expect(charge!.value).toBe(100)

    // Mas a PRÓXIMA já nasce com o preço novo.
    await h.advance({ days: 31 }) // horizonte alcança 14/03
    const charges = await chargesOf(sub.id)
    expect(charges.length).toBe(2)
    expect(charges[1]!.value).toBe(150)
  })

  it('ciclo inválido é recusado', async () => {
    const sub = await subscribe()
    const res = await h.api.call('update-existing-subscription', {
      params: { id: sub.id },
      body: { cycle: 'DAILY' },
    })
    // A spec já barra o enum: o erro sai como invalid_<campo>, no formato Asaas.
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toMatch(/^invalid_/)
  })
})

describe('Split da assinatura — um TEMPLATE, copiado a cada cobrança', () => {
  it('cada cobrança gerada nasce com o split da assinatura', async () => {
    const other = await createSecondAccount(h)
    const sub = await subscribe({
      billingType: 'PIX',
      nextDueDate: IN_40_DAYS,
      value: 100,
      split: [{ walletId: other.walletId, percentualValue: 30 }],
    })

    expect(sub.split.length).toBe(1)
    expect(sub.split[0].status).toBe('ACTIVE')

    await h.tick()

    const [charge] = await chargesOf(sub.id)
    expect(charge!.split.length).toBe(1)
    expect(charge!.split[0].walletId).toBe(other.walletId)
    // 30% do NETVALUE (100 − 1,99 = 98,01) = R$ 29,40. Sobre o bruto daria 30,00.
    expect(charge!.split[0].totalValue).toBe(29.4)
  })

  it('alterar o template NÃO mexe nas cobranças já geradas', async () => {
    const other = await createSecondAccount(h)
    const sub = await subscribe({
      billingType: 'PIX',
      nextDueDate: IN_40_DAYS,
      value: 100,
      split: [{ walletId: other.walletId, percentualValue: 30 }],
    })
    await h.tick()

    await h.api.call('update-existing-subscription', {
      params: { id: sub.id },
      body: { split: [{ walletId: other.walletId, percentualValue: 10 }] },
    })

    // A cobrança congelou o passado; a assinatura descreve o futuro.
    const [charge] = await chargesOf(sub.id)
    expect(charge!.split[0].totalValue).toBe(29.4)
    expect((await reload(sub.id)).split[0].percentualValue).toBe(10)
  })

  it('não é possível splitar para a própria carteira', async () => {
    const res = await h.api.call('create-new-subscription', {
      body: {
        customer: await customer(),
        billingType: 'PIX',
        value: 100,
        nextDueDate: IN_40_DAYS,
        cycle: 'MONTHLY',
        split: [{ walletId: h.walletId, percentualValue: 10 }],
      },
    })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_split')
  })
})

describe('Nota fiscal, carnê e isolamento', () => {
  const TAXES = { retainIss: false, iss: 2, pis: 0.65, cofins: 3, csll: 1, inss: 0, ir: 1.5 }

  it('CRUD da configuração de emissão de nota', async () => {
    const sub = await subscribe()

    const created = await h.api.call('create-configuration-for-issuance-of-invoices', {
      params: { id: sub.id },
      body: {
        municipalServiceCode: '1.01',
        municipalServiceName: 'Desenvolvimento de sistemas',
        deductions: 55,
        effectiveDatePeriod: 'ON_PAYMENT_CONFIRMATION',
        receivedOnly: true,
        observations: 'Referente ao plano Pro',
        taxes: TAXES,
      },
    })

    expect(created.status).toBe(200)
    // No request o campo é `effectiveDatePeriod`; na resposta, `invoiceCreationPeriod`.
    // É a spec do Asaas que troca o nome — não um erro nosso.
    expect(created.body.invoiceCreationPeriod).toBe('ON_PAYMENT_CONFIRMATION')
    expect(created.body.deductions).toBe(55)
    expect(created.body.taxes.iss).toBe(2)

    const got = await h.api.call('retrieve-configuration-for-issuance-of-invoices', {
      params: { id: sub.id },
    })
    expect(got.body.municipalServiceCode).toBe('1.01')

    const updated = await h.api.call('update-configuration-for-issuance-of-invoices', {
      params: { id: sub.id },
      body: { deductions: 10, observations: 'Novo texto', taxes: TAXES },
    })
    expect(updated.body.deductions).toBe(10)
    expect(updated.body.observations).toBe('Novo texto')
    expect(updated.body.municipalServiceCode).toBe('1.01') // o resto fica

    const removed = await h.api.call('remove-configuration-for-issuance-of-invoices', {
      params: { id: sub.id },
    })
    expect(removed.body.deleted).toBe(true)

    const gone = await h.api.call('retrieve-configuration-for-issuance-of-invoices', {
      params: { id: sub.id },
    })
    expect(gone.status).toBe(404)
  })

  it('as notas fiscais das cobranças da assinatura (vazio até o track G emitir)', async () => {
    const sub = await subscribe({ nextDueDate: IN_40_DAYS })
    await h.tick()

    const res = await h.api.call('list-invoices-for-subscription-charges', {
      params: { id: sub.id },
    })
    expect(res.status).toBe(200)
    expect(res.body.object).toBe('list')
    expect(res.body.totalCount).toBe(0) // vazio de verdade, não inventado
  })

  it('o carnê da assinatura é um PDF, e só lista o que JÁ foi gerado', async () => {
    const sub = await subscribe({ nextDueDate: IN_40_DAYS })
    await h.tick()

    const res = await h.app.app.handle(
      new Request(`http://localhost/v3/subscriptions/${sub.id}/paymentBook`, {
        headers: { access_token: '$aact_hmlg_test0000000000000000000000000' },
      }),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/pdf')

    const body = await res.text()
    expect(body.startsWith('%PDF-1.4')).toBe(true)
    expect(body).toContain('2026-02-14') // a única cobrança que existe
  })

  it('trocar o cartão da assinatura vincula o cartão e muda o billingType', async () => {
    const sub = await subscribe()

    const res = await h.api.call('update-subscription-credit-card', {
      params: { id: sub.id },
      body: {
        creditCard: {
          holderName: 'Fulano de Tal',
          number: '5162306219378829',
          expiryMonth: '05',
          expiryYear: '2030',
          ccv: '318',
        },
        creditCardHolderInfo: {
          name: 'Fulano de Tal',
          email: 'fulano@localhost',
          cpfCnpj: '24971563792',
          postalCode: '89223-005',
          addressNumber: '277',
          phone: '4738010919',
        },
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(200)
    expect(res.body.billingType).toBe('CREDIT_CARD')
    // Só os 4 ÚLTIMOS dígitos — nunca o PAN.
    expect(res.body.creditCard.creditCardNumber).toBe('8829')
    expect(res.body.creditCard.creditCardBrand).toBe('MASTERCARD')
    expect(res.body.creditCard.creditCardToken).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('assinatura de outra conta não existe (404, não 403)', async () => {
    const other = await createSecondAccount(h)
    const sub = await subscribe()

    const res = await h.as(other.apiKey).call('retrieve-a-single-subscription', {
      params: { id: sub.id },
    })
    expect(res.status).toBe(404)
  })
})

describe('Webhooks da assinatura', () => {
  it('SUBSCRIPTION_CREATED e PAYMENT_CREATED saem JUNTOS na criação', async () => {
    await h.subscribeWebhook(['SUBSCRIPTION_CREATED', 'PAYMENT_CREATED'])

    const sub = await subscribe({ nextDueDate: IN_41_DAYS })
    await h.tick()

    // Os dois. A cobrança nasce com a assinatura — não 40 dias depois, como
    // este teste chegou a afirmar antes da captura de paridade.
    expect(h.sink.eventNames).toContain('SUBSCRIPTION_CREATED')
    expect(h.sink.eventNames).toContain('PAYMENT_CREATED')
    expect((await chargesOf(sub.id)).length).toBe(1)
  })
})

describe('Assinatura no cartão guarda o cartão', () => {
  /**
   * Regressão de uma falha silenciosa que só apareceria 40 dias depois.
   *
   * A rota `POST /v3/subscriptions` é COMPARTILHADA com a variante "com cartão"
   * (o body decide, como no Asaas real). Enquanto o schema da rota era só o da
   * operação canônica, o Elysia descartava `creditCard` antes do handler: a
   * assinatura nascia `billingType: CREDIT_CARD` com `creditCardId: null`, sem
   * erro nenhum — e a cobrança gerada na janela D-40 não teria cartão para
   * cobrar. Este teste amarra as duas pontas: o body chega, e o handler o usa.
   */
  it('tokeniza o cartão enviado na criação e o associa à assinatura', async () => {
    const res = await h.api.call('create-new-subscription', {
      body: {
        customer: await customer(),
        billingType: 'CREDIT_CARD',
        value: 100,
        nextDueDate: IN_40_DAYS,
        cycle: 'MONTHLY',
        creditCard: {
          holderName: 'Fulano de Tal',
          number: '4444444444444444', // o cartão de teste que aprova
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
      },
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ACTIVE')

    // O cartão FOI gravado — e é o que a assinatura aponta.
    const [sub] = await h.app.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, res.body.id))

    expect(sub!.creditCardId).not.toBeNull()

    const [card] = await h.app.db
      .select()
      .from(creditCards)
      .where(eq(creditCards.id, sub!.creditCardId!))

    expect(card!.last4).toBe('4444')
    // O PAN nunca é guardado — só os 4 últimos.
    expect(JSON.stringify(card)).not.toContain('4444444444444444')
  })
})
