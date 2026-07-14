/**
 * Cartão de crédito — track H.
 *
 * Os três fatos que este arquivo existe para provar, e que o sandbox do Asaas
 * não deixa você testar:
 *
 *   1. Uma cobrança de cartão nasce CONFIRMED. Não PENDING. A `dueDate` não adia
 *      nada — a captura é no ato da criação.
 *   2. O dinheiro só existe em D+32. Aqui isso leva milissegundos.
 *   3. O cartão de recusa devolve 400 e a cobrança NÃO é criada.
 *
 * E um invariante de segurança: o PAN completo não fica em lugar nenhum — nem na
 * resposta, nem em NENHUMA tabela do banco.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { eq, sql } from 'drizzle-orm'
import { creditCards, financialTransactions } from '../../src/db/schema/index.ts'
import { CARD_ERRORS } from '../../src/domain/credit-card.ts'
import { chargebackHandlers } from '../../src/modules/chargebacks/handlers.ts'
import { creditCardHandlers } from '../../src/modules/credit-cards/handlers.ts'
import { createHarness, type Harness } from '../helpers/harness.ts'

/** Os cartões de teste do sandbox do Asaas. */
const APPROVES = '4444444444444444'
const DECLINES = '5184019740373151'
const DECLINES_TOO = '4916561358240741'
/** Passa no Luhn, não está na tabela de teste → aprova. */
const VALID_VISA = '4111111111111111'
/** Diners válido (14 dígitos): máximo de 12 parcelas. */
const VALID_DINERS = '30569309025904'

const card = (number: string) => ({
  holderName: 'John Doe',
  number,
  expiryMonth: '12',
  expiryYear: '2030',
  ccv: '123',
})

const holderInfo = {
  name: 'John Doe',
  email: 'john.doe@localhost',
  cpfCnpj: '24971563792',
  postalCode: '89223005',
  addressNumber: '277',
  phone: '4738010919',
}

let h: Harness

beforeEach(async () => {
  // O track H ainda não está no HANDLERS global — o harness registra os handlers
  // do track e exercita o servidor de verdade.
  h = await createHarness()
})
afterEach(() => h.close())

async function customer(): Promise<string> {
  const res = await h.api.call('create-new-customer', {
    body: { name: 'Fulano de Tal', cpfCnpj: '24971563792' },
  })
  return res.body.id
}

const ledgerOf = async (accountId: string) =>
  h.app.db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.accountId, accountId))

/** Varre TODAS as tabelas do banco atrás do número do cartão. */
async function assertPanIsNowhere(pan: string): Promise<void> {
  const tables = (await h.app.db.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table'`,
  )) as { name: string }[]

  for (const { name } of tables) {
    const rows = await h.app.db.all(sql.raw(`SELECT * FROM "${name}"`))
    expect(JSON.stringify(rows)).not.toContain(pan)
  }
}

// ─────────────────────────────────────────────────────────────
describe('Tokenização', () => {
  it('devolve os 4 ÚLTIMOS dígitos, a bandeira e um token — e o PAN some', async () => {
    const cus = await customer()

    const res = await h.api.call('credit-card-tokenization', {
      body: {
        customer: cus,
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(200)
    // Os 4 últimos dígitos — não uma máscara com asteriscos, não o número.
    expect(res.body.creditCardNumber).toBe('4444')
    expect(res.body.creditCardBrand).toBe('VISA')
    expect(res.body.creditCardToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )

    // Nem na resposta…
    expect(JSON.stringify(res.body)).not.toContain(APPROVES)

    // …nem em NENHUMA tabela do banco.
    await assertPanIsNowhere(APPROVES)

    const [row] = await h.app.db.select().from(creditCards)
    expect(row!.last4).toBe('4444')
    expect(row!.brand).toBe('VISA')
    expect(row!.simulatedOutcome).toBe('APPROVE')
  })

  /**
   * A TOKENIZAÇÃO AUTORIZA — capturado do sandbox (tools/probe-tokenization.ts).
   * Este teste afirmava o contrário ("a recusa é na hora do uso") e o mock
   * tokenizava qualquer cartão: o app dizia "cartão salvo!" e só quebrava na
   * primeira cobrança. É exatamente o bug que uma feature de cartão memorizado
   * não pode ter.
   */
  it('o cartão de recusa NÃO tokeniza — a autorização acontece ao salvar', async () => {
    const cus = await customer()
    const res = await h.api.call('credit-card-tokenization', {
      body: {
        customer: cus,
        creditCard: card(DECLINES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0]).toEqual(CARD_ERRORS.DECLINE)
    // E nada ficou no cofre: um cartão que não autoriza não é guardado.
    expect(await h.app.db.select().from(creditCards)).toHaveLength(0)
  })

  /**
   * O buraco do sandbox que este mock tapa: no Asaas real um cartão salvo SEMPRE
   * aprova (o ruim nunca vira token), então não há como testar "o cartão do
   * cliente falhou na renovação" — que é o cenário que de fato quebra a feature.
   * `4000000000000341` é nosso, e entrega o erro REAL.
   */
  it('4000000000000341 tokeniza, e recusa quando o token é cobrado', async () => {
    const cus = await customer()
    const tok = await h.api.call('credit-card-tokenization', {
      body: {
        customer: cus,
        creditCard: card('4000000000000341'),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })
    expect(tok.status).toBe(200)

    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCardToken: tok.body.creditCardToken,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0]).toEqual(CARD_ERRORS.DECLINE)
  })

  /**
   * O Asaas NÃO valida Luhn — capturado do sandbox (tools/probe-cards.ts). Este
   * teste afirmava o contrário e o mock recusava: um cartão que passa em produção
   * quebrava aqui. É a direção perigosa do erro, e por isso vira teste.
   */
  it('número que falha no Luhn TOKENIZA — o Asaas aceita dígito verificador errado', async () => {
    const cus = await customer()
    const res = await h.api.call('credit-card-tokenization', {
      body: {
        customer: cus,
        creditCard: card('5184019740373152'), // um dígito trocado
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(200)
    expect(await h.app.db.select().from(creditCards)).toHaveLength(1)
  })

  it('número curto demais → 400 invalid_creditCard, com a frase do Asaas', async () => {
    const cus = await customer()
    const res = await h.api.call('credit-card-tokenization', {
      body: {
        customer: cus,
        creditCard: card('411111111111'),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0]).toEqual(CARD_ERRORS.INVALID_NUMBER)
    expect(await h.app.db.select().from(creditCards)).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────
describe('Cobrança com cartão — CONFIRMED na hora', () => {
  it('4444444444444444 → 200 e status CONFIRMED, não PENDING', async () => {
    const cus = await customer()

    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        // Vencimento no futuro: no cartão isso NÃO adia nada. A captura é agora.
        dueDate: '2026-02-10',
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(200) // criação é 200, nunca 201
    expect(res.body.status).toBe('CONFIRMED')

    // Taxa do cartão à vista: R$ 0,49 + 2,99% de R$ 100 = R$ 3,48
    expect(res.body.value).toBe(100)
    expect(res.body.netValue).toBe(96.52)

    // A captura é HOJE (05/01), não no vencimento → crédito em 06/02.
    // O Asaas real INCLUI `confirmedDate` no payload — mas só quando o
    // billingType é CREDIT_CARD. Num Pix ou boleto a chave nem existe. Este
    // teste afirmava o contrário; a captura de paridade corrigiu.
    expect(res.body.confirmedDate).toBe('2026-01-05')
    expect(res.body.estimatedCreditDate).toBe('2026-02-06')

    expect(res.body.creditCard).toEqual({
      creditCardNumber: '4444',
      creditCardBrand: 'VISA',
      creditCardToken: expect.any(String),
    })
    expect(JSON.stringify(res.body)).not.toContain(APPROVES)

    // CONFIRMED não é dinheiro em caixa.
    expect(await ledgerOf(h.accountId)).toHaveLength(0)
    await h.assertLedgerBalances()
  })

  it('o dinheiro só entra em D+32 — com PAYMENT_RECEIVED e PAYMENT_FEE no extrato', async () => {
    const cus = await customer()
    await h.subscribeWebhook(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])

    const created = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })
    expect(created.body.status).toBe('CONFIRMED')

    await h.advance({ days: 31 })
    let p = await h.api.call('retrieve-a-single-payment', { params: { id: created.body.id } })
    expect(p.body.status).toBe('CONFIRMED')
    expect(await ledgerOf(h.accountId)).toHaveLength(0)

    // O 32º dia.
    await h.advance({ days: 1 })

    p = await h.api.call('retrieve-a-single-payment', { params: { id: created.body.id } })
    expect(p.body.status).toBe('RECEIVED')
    expect(p.body.creditDate).toBe('2026-02-06')

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual(['PAYMENT_RECEIVED', 'PAYMENT_FEE'])
    expect(ledger[0]!.valueCents).toBe(10_000) // +R$ 100,00
    expect(ledger[1]!.valueCents).toBe(-348) // −R$ 3,48 (0,49 + 2,99%)
    expect(ledger[1]!.balanceCents).toBe(9652)

    expect(h.sink.eventNames).toContain('PAYMENT_CONFIRMED')
    expect(h.sink.eventNames).toContain('PAYMENT_RECEIVED')

    await h.assertLedgerBalances()
  })

  it('um cartão válido qualquer (que passa no Luhn) também aprova', async () => {
    const cus = await customer()
    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 50,
        dueDate: '2026-01-10',
        creditCard: card(VALID_VISA),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CONFIRMED')
  })

  it('cobra com um token já existente, sem reenviar o cartão', async () => {
    const cus = await customer()

    const tok = await h.api.call('credit-card-tokenization', {
      body: {
        customer: cus,
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCardToken: tok.body.creditCardToken,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CONFIRMED')
    // Reaproveita o cartão: não cria uma segunda linha.
    expect(await h.app.db.select().from(creditCards)).toHaveLength(1)
    expect(res.body.creditCard.creditCardToken).toBe(tok.body.creditCardToken)
  })
})

// ─────────────────────────────────────────────────────────────
describe('Recusa — 400 e a cobrança não existe', () => {
  for (const pan of [DECLINES, DECLINES_TOO]) {
    it(`${pan} → 400, e nenhuma cobrança é criada`, async () => {
      const cus = await customer()

      const res = await h.api.call('create-new-payment-with-credit-card', {
        body: {
          customer: cus,
          billingType: 'CREDIT_CARD',
          value: 100,
          dueDate: '2026-01-10',
          creditCard: card(pan),
          creditCardHolderInfo: holderInfo,
          remoteIp: '116.213.42.53',
        },
      })

      expect(res.status).toBe(400)
      // O código é `invalid_action`, NÃO `invalid_creditCard` — capturado do
      // sandbox. Antes disto o mock devolvia o código errado, e um cliente que
      // ramifica por `code` se comportava diferente aqui e lá.
      expect(res.body.errors[0]).toEqual(CARD_ERRORS.DECLINE)
      // Mensagem GENÉRICA: o Asaas não diz o motivo da recusa, e não há campo de
      // razão no corpo. Inventar um ensinaria o cliente a tratar ficção.
      expect(res.body.errors[0].description).not.toContain('limite')

      // A cobrança NÃO foi criada — não é uma cobrança "recusada".
      const list = await h.api.call('list-payments')
      expect(list.body.totalCount).toBe(0)
      // E o cartão recusado também não ficou gravado.
      expect(await h.app.db.select().from(creditCards)).toHaveLength(0)

      await h.assertLedgerBalances()
    })
  }

  /**
   * O cartão de recusa não chega mais a virar token (a tokenização autoriza), então
   * "recusar por token" é exercitado pelo cartão de simulação `4000000000000341`,
   * no bloco de Tokenização. Aqui garantimos só que a recusa por token não deixa
   * cobrança órfã.
   */
  it('recusa por token não cria cobrança', async () => {
    const cus = await customer()

    const tok = await h.api.call('credit-card-tokenization', {
      body: {
        customer: cus,
        creditCard: card('4000000000000341'), // tokeniza, mas recusa ao cobrar
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCardToken: tok.body.creditCardToken,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    const list = await h.api.call('list-payments')
    expect(list.body.totalCount).toBe(0)
    await h.assertLedgerBalances()
  })

  /**
   * O TOKEN É PRESO AO CLIENTE — capturado. Usar o token do cliente A para cobrar
   * o B devolve "não encontrado" (o Asaas nem admite que o token existe). O mock
   * aceitava, e um app que embaralhasse tokens entre clientes só descobriria em
   * produção.
   */
  it('o token do cliente A NÃO cobra o cliente B', async () => {
    const cusA = await customer()
    const tok = await h.api.call('credit-card-tokenization', {
      body: {
        customer: cusA,
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })
    const token = tok.body.creditCardToken

    const cusB = (
      await h.api.call('create-new-customer', {
        body: { name: 'Outro Cliente', cpfCnpj: '24971563792' },
      })
    ).body.id

    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cusB,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCardToken: token,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_creditCard')
    expect(res.body.errors[0].description).toBe(`CreditCardToken ${token} não encontrado.`)
  })

  /**
   * A pegadinha do "revalidar o CVV na recompra": mandar o token JUNTO com um
   * `creditCard` parcial faz o Asaas exigir o cartão inteiro — e devolver um erro
   * POR CAMPO. O mock devolvia "Expected union value", um erro interno do
   * validador vazando para o cliente.
   */
  it('token + creditCard parcial → um erro por campo faltante', async () => {
    const cus = await customer()
    const tok = await h.api.call('credit-card-tokenization', {
      body: {
        customer: cus,
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCardToken: tok.body.creditCardToken,
        creditCard: { ccv: '318' }, // só o CVV
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors.map((e: { description: string }) => e.description)).toEqual([
      'Informe o nome do portador.',
      'Informe o número do seu cartão.',
      'Informe o mês de vencimento do seu cartão.',
      'Informe o ano de vencimento do seu cartão.',
    ])
  })
})

// ─────────────────────────────────────────────────────────────
describe('Pré-autorização', () => {
  it('authorizeOnly → AUTHORIZED sem crédito; captura → CONFIRMED; capturar de novo → 400', async () => {
    const cus = await customer()

    const created = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
        authorizeOnly: true,
      },
    })

    expect(created.status).toBe(200)
    // AUTHORIZED não existe em NENHUM enum da spec do Asaas — está no overlay 001.
    expect(created.body.status).toBe('AUTHORIZED')
    expect(await ledgerOf(h.accountId)).toHaveLength(0)

    // Pré-autorizada não credita nunca — nem depois de 32 dias.
    await h.advance({ days: 32 })
    const still = await h.api.call('retrieve-a-single-payment', {
      params: { id: created.body.id },
    })
    expect(still.body.status).toBe('AUTHORIZED')
    expect(await ledgerOf(h.accountId)).toHaveLength(0)

    const captured = await h.api.call('capture-payment-with-pre-authorization', {
      params: { id: created.body.id },
      body: {},
    })
    expect(captured.status).toBe(200)
    expect(captured.body.status).toBe('CONFIRMED')
    // Captura em 06/02 → crédito em 10/03 (D+32 da CAPTURA, não da criação).
    expect(captured.body.estimatedCreditDate).toBe('2026-03-10')

    // Capturar de novo: a máquina de estados recusa.
    const again = await h.api.call('capture-payment-with-pre-authorization', {
      params: { id: created.body.id },
      body: {},
    })
    expect(again.status).toBe(400)
    expect(again.body.errors[0].code).toBe('invalid_action')

    // E o dinheiro entra 32 dias depois da captura.
    await h.advance({ days: 32 })
    const settled = await h.api.call('retrieve-a-single-payment', {
      params: { id: created.body.id },
    })
    expect(settled.body.status).toBe('RECEIVED')

    const ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual(['PAYMENT_RECEIVED', 'PAYMENT_FEE'])
    await h.assertLedgerBalances()
  })

  it('a configuração de pré-autorização é lida e gravada', async () => {
    const before = await h.api.call('retrieve-pre-authorization-configuration')
    expect(before.status).toBe(200)
    expect(before.body.daysToExpire).toBe(5) // default

    const saved = await h.api.call('save-or-update-pre-authorization-configuration', {
      body: { daysToExpire: 10 },
    })
    expect(saved.body.daysToExpire).toBe(10)

    const after = await h.api.call('retrieve-pre-authorization-configuration')
    expect(after.body.daysToExpire).toBe(10)

    const bad = await h.api.call('save-or-update-pre-authorization-configuration', {
      body: { daysToExpire: 0 },
    })
    expect(bad.status).toBe(400)
    expect(bad.body.errors[0].code).toBe('invalid_daysToExpire')
  })
})

// ─────────────────────────────────────────────────────────────
describe('Pagar uma cobrança que já existe', () => {
  it('payWithCreditCard: PENDING → CONFIRMED, e a taxa vira a do cartão', async () => {
    const cus = await customer()

    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'UNDEFINED', value: 100, dueDate: '2026-01-10' },
    })
    expect(created.body.status).toBe('PENDING')
    expect(created.body.netValue).toBe(100) // UNDEFINED não tem taxa: ainda não se sabe o meio

    const paid = await h.api.call('pay-a-charge-with-credit-card', {
      params: { id: created.body.id },
      body: { creditCard: card(APPROVES), creditCardHolderInfo: holderInfo },
    })

    expect(paid.status).toBe(200)
    expect(paid.body.status).toBe('CONFIRMED')
    expect(paid.body.billingType).toBe('CREDIT_CARD')
    // Pagou no cartão → a taxa passa a ser a do cartão.
    expect(paid.body.netValue).toBe(96.52)
    expect(paid.body.creditCard.creditCardNumber).toBe('4444')

    await h.advance({ days: 32 })
    const settled = await h.api.call('retrieve-a-single-payment', {
      params: { id: created.body.id },
    })
    expect(settled.body.status).toBe('RECEIVED')
    await h.assertLedgerBalances()
  })

  it('payWithCard (cardType CREDIT) faz o mesmo', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'CREDIT_CARD', value: 100, dueDate: '2026-01-10' },
    })

    const paid = await h.api.call('pay-a-charge-with-card', {
      params: { id: created.body.id },
      body: { cardType: 'CREDIT', card: card(APPROVES) },
    })

    expect(paid.status).toBe(200)
    expect(paid.body.status).toBe('CONFIRMED')
  })

  it('payWithCreditCard com cartão recusado → 400 e a cobrança segue PENDING', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'CREDIT_CARD', value: 100, dueDate: '2026-01-10' },
    })

    const res = await h.api.call('pay-a-charge-with-credit-card', {
      params: { id: created.body.id },
      body: { creditCard: card(DECLINES), creditCardHolderInfo: holderInfo },
    })

    expect(res.status).toBe(400)
    const p = await h.api.call('retrieve-a-single-payment', { params: { id: created.body.id } })
    expect(p.body.status).toBe('PENDING')
    await h.assertLedgerBalances()
  })
})

// ─────────────────────────────────────────────────────────────
describe('Validações', () => {
  it('sem remoteIp → 400 invalid_remoteIp', async () => {
    const cus = await customer()
    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_remoteIp')
  })

  /** Ver a explicação no bloco de tokenização: o Asaas não valida Luhn. */
  it('número que falha no Luhn é COBRADO — o Asaas não valida Luhn', async () => {
    const cus = await customer()
    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCard: card('4916561358240742'), // um dígito trocado
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CONFIRMED')
  })

  it('cartão EXPIRADO → 400, com a frase do Asaas', async () => {
    const cus = await customer()
    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCard: { ...card(APPROVES), expiryMonth: '05', expiryYear: '2020' },
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0]).toEqual(CARD_ERRORS.EXPIRED)
    const list = await h.api.call('list-payments')
    expect(list.body.totalCount).toBe(0)
  })

  /**
   * O cartão de SIMULAÇÃO: não existe no Asaas (lá ele aprovaria), e existe aqui
   * para que dê para exercitar o tratamento de erro trocando um número.
   */
  it('4000000000000069 força "cartão expirado" mesmo com validade no futuro', async () => {
    const cus = await customer()
    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCard: card('4000000000000069'), // validade 12/2030, e ainda assim expira
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0]).toEqual(CARD_ERRORS.EXPIRED)
  })

  it('15x no Diners (máximo 12) → 400 invalid_installmentCount', async () => {
    const cus = await customer()
    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        // `value` é `required` no schema da spec mesmo numa cobrança parcelada
        // (é o parcelamento que usa totalValue) — sem ele o Elysia rejeita antes
        // de o handler ver o body.
        value: 1500,
        totalValue: 1500,
        installmentCount: 15,
        dueDate: '2026-01-10',
        creditCard: card(VALID_DINERS),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_installmentCount')
    expect(res.body.errors[0].description).toContain('12')
    const list = await h.api.call('list-payments')
    expect(list.body.totalCount).toBe(0)
  })

  it('token de outra conta não é aceito (isolamento)', async () => {
    const cus = await customer()
    const tok = await h.api.call('credit-card-tokenization', {
      body: {
        customer: cus,
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    const { createSecondAccount } = await import('../helpers/harness.ts')
    const other = await createSecondAccount(h)
    const otherApi = h.as(other.apiKey)

    const otherCustomer = await otherApi.call('create-new-customer', {
      body: { name: 'Beltrano', cpfCnpj: '24971563792' },
    })

    const res = await otherApi.call('create-new-payment-with-credit-card', {
      body: {
        customer: otherCustomer.body.id,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCardToken: tok.body.creditCardToken,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    // O código é `invalid_creditCard` e a frase CARREGA o token — capturado.
    // Antes era `invalid_creditCardToken` com uma frase genérica, ambos inventados.
    expect(res.body.errors[0].code).toBe('invalid_creditCard')
    expect(res.body.errors[0].description).toBe(
      `CreditCardToken ${tok.body.creditCardToken} não encontrado.`,
    )
  })

  it('cartão com billingType diferente de CREDIT_CARD → 400', async () => {
    const cus = await customer()
    const res = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'BOLETO',
        value: 100,
        dueDate: '2026-01-10',
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_billingType')
  })
})

// ─────────────────────────────────────────────────────────────
describe('Chargeback', () => {
  /**
   * A API do Asaas não tem operação de ABRIR chargeback (quem abre é a
   * bandeira). A porta é administrativa — o mesmo lugar de onde se viaja no
   * tempo. Sem ela, nenhum dev conseguiria testar o fluxo.
   */
  const openChargeback = (paymentId: string, reason = 'FRAUD') =>
    h.app.app.handle(
      new Request(`http://localhost/_admin/payments/${paymentId}/chargeback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),
    )

  /** Uma cobrança de cartão já RECEIVED (D+32 cumprido). */
  async function received(): Promise<string> {
    const cus = await customer()
    const created = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })
    await h.advance({ days: 32 })
    return created.body.id
  }

  it('debita o valor do saldo e leva a cobrança a CHARGEBACK_REQUESTED', async () => {
    const id = await received()

    let ledger = await ledgerOf(h.accountId)
    expect(ledger[ledger.length - 1]!.balanceCents).toBe(9652) // R$ 96,52 em caixa

    const res = await openChargeback(id)
    expect(res.status).toBe(200)

    const p = await h.api.call('retrieve-a-single-payment', { params: { id } })
    expect(p.body.status).toBe('CHARGEBACK_REQUESTED')
    // O objeto chargeback aparece na cobrança — com os 4 últimos dígitos do cartão.
    expect(p.body.chargeback.status).toBe('REQUESTED')
    expect(p.body.chargeback.reason).toBe('FRAUD')
    expect(p.body.chargeback.value).toBe(100)
    expect(p.body.chargeback.creditCard).toEqual({ number: '4444', brand: 'VISA' })

    // O dinheiro VOLTA para o portador: débito do valor BRUTO (a taxa não volta).
    ledger = await ledgerOf(h.accountId)
    expect(ledger.map((l) => l.type)).toEqual(['PAYMENT_RECEIVED', 'PAYMENT_FEE', 'CHARGEBACK'])
    expect(ledger[2]!.valueCents).toBe(-10_000)
    expect(ledger[2]!.balanceCents).toBe(-348) // fica NEGATIVO pela taxa retida

    await h.assertLedgerBalances()
  })

  it('uma CONFIRMED (que ainda não creditou) não gera lançamento — não há o que debitar', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment-with-credit-card', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        value: 100,
        dueDate: '2026-01-10',
        creditCard: card(APPROVES),
        creditCardHolderInfo: holderInfo,
        remoteIp: '116.213.42.53',
      },
    })

    await openChargeback(created.body.id)

    const p = await h.api.call('retrieve-a-single-payment', { params: { id: created.body.id } })
    expect(p.body.status).toBe('CHARGEBACK_REQUESTED')
    expect(await ledgerOf(h.accountId)).toHaveLength(0)

    await h.assertLedgerBalances()
  })

  it('lista, recupera e abre disputa', async () => {
    const id = await received()
    await openChargeback(id, 'COMMERCIAL_DISAGREEMENT')

    const list = await h.api.call('list-chargebacks')
    expect(list.status).toBe(200)
    expect(list.body.totalCount).toBe(1)
    expect(list.body.data[0].reason).toBe('COMMERCIAL_DISAGREEMENT')

    const one = await h.api.call('retrieve-a-single-chargeback', { params: { id } })
    expect(one.status).toBe(200)
    expect(one.body.status).toBe('REQUESTED')
    expect(one.body.disputeStartDate).toBe('2026-02-06')
    expect(one.body.deadlineToSendDisputeDocuments).toBe('2026-02-26')

    // A disputa é multipart — o ApiClient só fala JSON, então vai na mão.
    const form = new FormData()
    form.append('files', new File(['comprovante'], 'nota-fiscal.pdf'))

    const dispute = await h.app.app.handle(
      new Request(`http://localhost/v3/chargebacks/${one.body.id}/dispute`, {
        method: 'POST',
        headers: { access_token: '$aact_hmlg_test0000000000000000000000000' },
        body: form,
      }),
    )
    expect(dispute.status).toBe(200)
    expect(await dispute.json()).toEqual({
      chargebackId: one.body.id,
      status: 'REQUESTED',
      files: ['nota-fiscal.pdf'],
    })

    const after = await h.api.call('retrieve-a-single-chargeback', { params: { id } })
    expect(after.body.status).toBe('IN_DISPUTE')
    expect(after.body.disputeStatus).toBe('REQUESTED')

    await h.assertLedgerBalances()
  })

  it('cobrança sem chargeback → 404', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'PIX', value: 10, dueDate: '2026-01-10' },
    })

    const res = await h.api.call('retrieve-a-single-chargeback', {
      params: { id: created.body.id },
    })
    expect(res.status).toBe(404)
  })

  it('não dá para abrir chargeback numa cobrança que não foi paga', async () => {
    const cus = await customer()
    const created = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'BOLETO', value: 10, dueDate: '2026-01-10' },
    })

    const res = await openChargeback(created.body.id)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { errors: { code: string }[] }
    expect(body.errors[0]!.code).toBe('invalid_action')
  })
})
