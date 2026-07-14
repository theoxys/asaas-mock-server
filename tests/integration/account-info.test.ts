/**
 * Account info — a conta autenticada.
 *
 * O que estes testes protegem, além do contrato: a tabela de taxas devolvida por
 * GET /v3/myAccount/fees vem da MESMA config que o motor usa para cobrar. Se
 * alguém "corrigir" a resposta com um número fixo, o teste quebra.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { accountInfoHandlers } from '../../src/modules/account-info/handlers.ts'
import { createHarness, createSecondAccount, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeAll(async () => {
  h = await createHarness()
})
afterAll(() => h.close())

describe('dados comerciais', () => {
  it('recupera os dados da conta semeada', async () => {
    const { status, body } = await h.api.call('retrieve-business-data')

    expect(status).toBe(200)
    expect(body.name).toBe('Conta de Teste')
    expect(body.cpfCnpj).toBe('47960950000121')
    expect(body.personType).toBe('JURIDICA')
    expect(body.status).toBe('APPROVED')
  })

  it('atualiza e devolve o estado novo — dinheiro faz round-trip em centavos', async () => {
    const { status, body } = await h.api.call('update-business-data', {
      body: {
        companyName: 'ASAAS GESTAO',
        incomeValue: 2500.55,
        email: 'novo@localhost',
        site: 'https://exemplo.com.br',
        postalCode: '89223005',
      },
    })

    expect(status).toBe(200)
    expect(body.companyName).toBe('ASAAS GESTAO')
    expect(body.incomeValue).toBe(2500.55)
    expect(body.email).toBe('novo@localhost')
    // O Asaas preenche o nome de exibição sozinho a partir da razão social.
    expect(body.tradingName).toBe('ASAAS GESTAO')

    const again = await h.api.call('retrieve-business-data')
    expect(again.body.incomeValue).toBe(2500.55)
    expect(again.body.site).toBe('https://exemplo.com.br')
  })

  it('CPF/CNPJ inválido → 400 invalid_cpfCnpj (array, como sempre)', async () => {
    const { status, body } = await h.api.call('update-business-data', {
      body: { cpfCnpj: '11111111111' },
    })

    expect(status).toBe(400)
    expect(Array.isArray(body.errors)).toBe(true)
    expect(body.errors[0].code).toBe('invalid_cpfCnpj')
  })
})

describe('taxas', () => {
  it('a resposta é derivada de config.fees, não de um JSON fixo', async () => {
    const { status, body } = await h.api.call('retrieve-account-fees')
    const fees = h.app.config.fees

    expect(status).toBe(200)
    expect(body.payment.bankSlip.defaultValue).toBe(fees.boleto / 100)
    expect(body.payment.creditCard.operationValue).toBe(fees.creditCard.fixed / 100)
    expect(body.payment.creditCard.oneInstallmentPercentage).toBe(2.99)
    expect(body.payment.creditCard.daysToReceive).toBe(32)
    expect(body.payment.pix.fixedFeeValue).toBe(fees.pix / 100)
    expect(body.creditBureauReport.naturalPersonFeeValue).toBe(16.99)
    expect(body.transfer.ted.feeValue).toBe(5)
  })

  it('mudar a config muda a resposta', async () => {
    const other = await createHarness({ fees: { ...h.app.config.fees, boleto: 349 as never } })
    try {
      const { body } = await other.api.call('retrieve-account-fees')
      expect(body.payment.bankSlip.defaultValue).toBe(3.49)
    } finally {
      other.close()
    }
  })
})

describe('número da conta, status e wallet', () => {
  it('o número da conta é atribuído uma vez e não muda', async () => {
    const first = await h.api.call('retrieve-asaas-account-number')
    const second = await h.api.call('retrieve-asaas-account-number')

    expect(first.status).toBe(200)
    expect(first.body.agency).toBe('0001')
    expect(first.body.account).toMatch(/^\d{6}$/)
    expect(second.body).toEqual(first.body)
  })

  it('status de cadastro: em sandbox a conta nasce aprovada', async () => {
    const { status, body } = await h.api.call('check-account-registration-status')

    expect(status).toBe(200)
    expect(body.id).toBe(h.accountId)
    expect(body.general).toBe('APPROVED')
    expect(body.commercialInfo).toBe('APPROVED')
  })

  it('walletId vem no envelope de lista, com a wallet da conta', async () => {
    const { status, body } = await h.api.call('retrieve-walletid')

    expect(status).toBe(200)
    expect(body.object).toBe('list')
    expect(body.totalCount).toBe(1)
    expect(body.data[0]).toEqual({ object: 'wallet', id: h.walletId })
  })
})

describe('personalização do checkout', () => {
  it('sem personalização salva, vem desabilitada', async () => {
    const { status, body } = await h.api.call('retrieve-personalization-settings')

    expect(status).toBe(200)
    expect(body.object).toBe('paymentCheckoutConfig')
    expect(body.enabled).toBe(false)
    expect(body.logoUrl).toBeNull()
  })

  it('salva, aprova sozinho em sandbox, e a leitura seguinte devolve o mesmo', async () => {
    const { status, body } = await h.api.call('save-payment-checkout-personalization', {
      body: {
        logoBackgroundColor: '#00ff00',
        infoBackgroundColor: '#000fff',
        fontColor: '#ffffff',
        enabled: true,
      },
    })

    expect(status).toBe(200)
    expect(body.status).toBe('APPROVED')
    expect(body.enabled).toBe(true)

    const again = await h.api.call('retrieve-personalization-settings')
    expect(again.body.logoBackgroundColor).toBe('#00ff00')
    expect(again.body.fontColor).toBe('#ffffff')
  })

  it('multipart não passa pelo TypeBox — o obrigatório é conferido no handler', async () => {
    const { status, body } = await h.api.call('save-payment-checkout-personalization', {
      body: { logoBackgroundColor: '#00ff00', infoBackgroundColor: '#000fff' },
    })

    expect(status).toBe(400)
    expect(body.errors[0].code).toBe('invalid_fontColor')
  })

  it('cor que não é hexadecimal → 400', async () => {
    const { status, body } = await h.api.call('save-payment-checkout-personalization', {
      body: {
        logoBackgroundColor: 'verde',
        infoBackgroundColor: '#000fff',
        fontColor: '#ffffff',
      },
    })

    expect(status).toBe(400)
    expect(body.errors[0].code).toBe('invalid_logoBackgroundColor')
  })
})

describe('desabilitar subconta white label', () => {
  it('a conta raiz não se autodestrói', async () => {
    const { status, body } = await h.api.call('Delete-white-label-subaccount', {
      query: { removeReason: 'Release data' },
    })

    expect(status).toBe(400)
    expect(body.errors[0].code).toBe('invalid_account')
  })

  it('a subconta é desabilitada — e só uma vez', async () => {
    const sub = await createSecondAccount(h, 'Subconta White Label')
    const client = h.as(sub.apiKey)

    const first = await client.call('Delete-white-label-subaccount', {
      query: { removeReason: 'Release data' },
    })
    expect(first.status).toBe(200)
    expect(first.body.observations).toBe('Conta desabilitada com sucesso')

    const second = await client.call('Delete-white-label-subaccount')
    expect(second.status).toBe(400)
    expect(second.body.errors[0].code).toBe('invalid_account')
  })

  it('cada conta vê os SEUS dados comerciais', async () => {
    const sub = await createSecondAccount(h, 'Outra Conta')
    const { body } = await h.as(sub.apiKey).call('retrieve-business-data')

    expect(body.name).toBe('Outra Conta')
    expect(body.cpfCnpj).not.toBe('47960950000121')
  })
})
