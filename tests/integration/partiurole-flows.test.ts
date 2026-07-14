/**
 * Os fluxos que o cliente real do simulador (PartiuRole) exercita.
 *
 * Cada teste aqui nasceu de uma chamada que o cliente FAZ e que o simulador
 * respondia errado. Os formatos foram capturados do sandbox real do Asaas em
 * 2026-07-14 — não são deduzidos da documentação.
 *
 * A lição que este arquivo registra: as duas falhas abaixo passavam pela
 * validação de contrato sem um arranhão. A spec do Asaas não descreve nem o
 * parcelamento por POST /v3/payments, nem que `creditCard` é dispensável quando
 * há token. Contrato verde não é o mesmo que API certa.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { isValidBrCode } from '../../src/domain/pix-brcode.ts'
import { createHarness, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

const CARD = {
  holderName: 'COMPRADOR TESTE',
  number: '4444444444444444',
  expiryMonth: '12',
  expiryYear: '2030',
  ccv: '123',
}
const HOLDER = {
  name: 'Comprador Teste',
  email: 'comprador@localhost.test',
  cpfCnpj: '24971563792',
  postalCode: '14079-452',
  addressNumber: '100',
  phone: '4796321478',
}

async function customer(): Promise<string> {
  const res = await h.api.call('create-new-customer', {
    body: { name: 'Comprador Teste', cpfCnpj: '24971563792' },
  })
  expect(res.status).toBe(200)
  return res.body.id
}

async function token(cus: string): Promise<string> {
  const res = await h.api.call('credit-card-tokenization', {
    body: { customer: cus, creditCard: CARD, creditCardHolderInfo: HOLDER, remoteIp: '8.8.8.8' },
  })
  expect(res.status).toBe(200)
  return res.body.creditCardToken
}

describe('parcelamento por POST /v3/payments', () => {
  /**
   * A porta que o cliente típico usa: `installmentCount` numa cobrança comum,
   * sem nunca ter ouvido falar de /v3/installments. O simulador RECUSAVA, com
   * um 400 "não implementado" — o fluxo de compra parcelada não existia.
   */
  it('devolve a PRIMEIRA PARCELA, não o objeto do parcelamento', async () => {
    const cus = await customer()

    const res = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'CREDIT_CARD',
        installmentCount: 3,
        totalValue: 300,
        dueDate: '2026-12-31',
        creditCardToken: await token(cus),
        remoteIp: '8.8.8.8',
      },
    })

    expect(res.status).toBe(200)

    // É um `payment`, e traz o vínculo com o parcelamento. Devolver o objeto do
    // parcelamento aqui (como faz POST /v3/installments) quebraria o cliente.
    expect(res.body.object).toBe('payment')
    expect(res.body.installment).toBeString()
    expect(res.body.installmentNumber).toBe(1)
    expect(res.body.description).toBe('Parcela 1 de 3.')

    // R$ 300 em 3x → parcela de R$ 100, taxa de R$ 3,65 → líquido R$ 96,35.
    // (sandbox real: value 100.00, netValue 96.35)
    expect(res.body.value).toBe(100)
    expect(res.body.netValue).toBe(96.35)

    // Com cartão, a parcela já nasce CONFIRMED — a emissora autoriza o total de
    // uma vez. Deixá-la PENDING seria uma falha silenciosa: a cobrança nunca
    // aconteceria e ninguém veria erro nenhum.
    expect(res.body.status).toBe('CONFIRMED')

    await h.assertLedgerBalances()
  })

  it('as 3 parcelas existem de verdade, e somam o total', async () => {
    const cus = await customer()

    const first = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'BOLETO',
        installmentCount: 3,
        totalValue: 100,
        dueDate: '2026-12-31',
      },
    })
    expect(first.status).toBe(200)

    const parts = await h.api.call('list-payments-of-a-installment', {
      params: { id: first.body.installment },
      query: { limit: 100 },
    })
    expect(parts.body.data.length).toBe(3)

    // A sobra do arredondamento vai na ÚLTIMA: 33,33 + 33,33 + 33,34 = 100,00.
    const values = parts.body.data.map((p: any) => p.value)
    expect(values).toEqual([33.33, 33.33, 33.34])
  })

  it('`installmentValue` é o valor DA PARCELA — não o total', async () => {
    const cus = await customer()

    // Em POST /v3/payments quem carrega o valor da parcela é `installmentValue`.
    // (Em POST /v3/installments é `value`. Os nomes divergem entre as duas portas.)
    const res = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'BOLETO',
        installmentCount: 4,
        installmentValue: 25,
        dueDate: '2026-12-31',
      },
    })

    expect(res.status).toBe(200)
    expect(res.body.value).toBe(25) // 4 × 25 = 100 de total
  })
})

describe('QR Code do Pix', () => {
  /**
   * Sem isto, uma compra por Pix não tem como ser paga: o QR e o "copia e cola"
   * são a única coisa que o comprador de fato usa. Respondia 501.
   */
  it('devolve um BR Code EMV válido e a imagem do QR', async () => {
    const cus = await customer()

    const pay = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'PIX', value: 100, dueDate: '2026-12-31' },
    })

    const res = await h.api.call('get-qr-code-for-pix-payments', {
      params: { id: pay.body.id },
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // O payload é um BR Code de verdade: TLV do Pix + CRC16 correto no fim.
    // Se o CRC estiver errado, o app do banco recusa — e é o tipo de coisa que
    // só se descobre com o celular na mão. Aqui se descobre no CI.
    expect(res.body.payload).toStartWith('000201')
    expect(res.body.payload).toContain('br.gov.bcb.pix')
    expect(isValidBrCode(res.body.payload)).toBe(true)

    // A imagem é um PNG de verdade (assinatura \x89PNG\r\n\x1a\n). Que o QR
    // dentro dele de fato CODIFICA este payload — isto é, que ele escaneia — é
    // provado em tests/unit/qrcode.test.ts, que decodifica a imagem de volta.
    const png = Buffer.from(res.body.encodedImage, 'base64')
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])

    // Expira um ANO depois do vencimento — não NO vencimento. Provado em dois
    // pontos contra o sandbox real, e é contraintuitivo o bastante para travar.
    expect(res.body.expirationDate).toBe('2027-12-31 23:59:59')

    // Sem descrição na cobrança, o Asaas devolve este texto. Sem acento.
    expect(res.body.description).toBe('Descricao nao informada')
  })

  it('BOLETO também tem QR — o Asaas emite boleto híbrido', async () => {
    const cus = await customer()

    const pay = await h.api.call('create-new-payment', {
      body: {
        customer: cus,
        billingType: 'BOLETO',
        value: 50,
        dueDate: '2026-08-20',
        description: 'Ingresso',
      },
    })

    const res = await h.api.call('get-qr-code-for-pix-payments', {
      params: { id: pay.body.id },
    })

    expect(res.status).toBe(200)
    expect(isValidBrCode(res.body.payload)).toBe(true)
    expect(res.body.expirationDate).toBe('2027-08-20 23:59:59')
    expect(res.body.description).toBe('Ingresso')
  })
})

describe('pagar cobrança com cartão JÁ TOKENIZADO', () => {
  /**
   * O ponto inteiro da tokenização é o PAN não voltar a trafegar. A spec do Asaas
   * marca `creditCard` e `creditCardHolderInfo` como obrigatórios; o Asaas real
   * não os exige. Enquanto o `required` estava no schema, o Elysia recusava o body
   * ANTES do handler — com erros do TypeBox em inglês, que nenhum cliente do Asaas
   * jamais veria. Ver spec/overlays/005.
   */
  it('aceita só o creditCardToken, e confirma', async () => {
    const cus = await customer()
    const tok = await token(cus)

    const pending = await h.api.call('create-new-payment', {
      body: { customer: cus, billingType: 'CREDIT_CARD', value: 150, dueDate: '2026-12-31' },
    })
    expect(pending.body.status).toBe('PENDING')

    const paid = await h.api.call('pay-a-charge-with-credit-card', {
      params: { id: pending.body.id },
      body: { creditCardToken: tok },
    })

    expect(paid.status).toBe(200)
    expect(paid.body.status).toBe('CONFIRMED')

    // O cartão volta na resposta — mascarado, e com o mesmo token.
    expect(paid.body.creditCard.creditCardToken).toBe(tok)
    expect(paid.body.creditCard.creditCardNumber).toBe('4444')

    // Confirmado hoje, mas o dinheiro só cai em D+32 — `creditDate` aponta para
    // o futuro e `paymentDate` continua NULA. É a assimetria que o Asaas tem e
    // que quase toda integração erra: `paymentDate` só é preenchida quando o
    // dinheiro de fato cai, não quando a compra é aprovada.
    expect(paid.body.confirmedDate).toBeString()
    expect(paid.body.creditDate > paid.body.confirmedDate).toBe(true)
    expect(paid.body.paymentDate).toBeNull()

    await h.assertLedgerBalances()
  })
})
