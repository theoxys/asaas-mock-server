/**
 * Subcontas.
 *
 * O que este arquivo prova, e que é o ponto todo: a subconta nasce com **chave
 * de API própria** e **walletId próprio**. A chave FUNCIONA, e a subconta é
 * ISOLADA — não enxerga as cobranças da conta que a criou.
 *
 * É o que separa "split" de "split de verdade": sem duas contas autenticáveis, o
 * walletId de destino seria uma string sem dono e o dinheiro não teria para onde
 * ir.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createHarness, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

/** O corpo mínimo que a spec exige. */
const body = (over: Record<string, unknown> = {}) => ({
  name: 'Loja do Fulano',
  email: 'loja@localhost',
  cpfCnpj: '12345678909',
  mobilePhone: '11999998888',
  incomeValue: 25000,
  address: 'Rua Fernando Orlandi',
  addressNumber: '544',
  province: 'Jardim Pedra Branca',
  postalCode: '14079-452',
  ...over,
})

describe('criação', () => {
  it('devolve 200 (nunca 201), com apiKey e walletId próprios', async () => {
    const res = await h.api.call('create-subaccount', { body: body() })

    expect(res.status).toBe(200)
    expect(res.body.object).toBe('account')
    expect(res.body.id).toBeString()
    expect(res.body.walletId).toBeString()
    expect(res.body.walletId).not.toBe(h.walletId)

    // A chave só aparece AQUI. É a única vez.
    expect(res.body.apiKey).toStartWith('$aact_hmlg_')
    expect(res.body.accessToken.apiKey).toBe(res.body.apiKey)

    expect(res.body.personType).toBe('FISICA')
    expect(res.body.cpfCnpj).toBe('12345678909')
    // Em sandbox a conta já nasce aprovada — não há análise a esperar.
    expect(res.body.accountNumber.agency).toBe('0001')
  })

  it('a chave da subconta FUNCIONA e a subconta é ISOLADA da conta pai', async () => {
    const sub = await h.api.call('create-subaccount', { body: body() })
    const as = h.as(sub.body.apiKey)

    // A conta pai cria uma cobrança.
    const cus = await h.api.call('create-new-customer', {
      body: { name: 'Cliente do Pai', cpfCnpj: '24971563792' },
    })
    await h.api.call('create-new-payment', {
      body: { customer: cus.body.id, billingType: 'PIX', value: 100, dueDate: '2026-01-10' },
    })

    expect((await h.api.call('list-payments')).body.totalCount).toBe(1)

    // A subconta não enxerga NADA disso. Nem a cobrança, nem o cliente.
    expect((await as.call('list-payments')).body.totalCount).toBe(0)
    expect((await as.call('list-customers')).body.totalCount).toBe(0)

    // Mas ela tem vida própria: cria cliente e cobrança dela.
    const own = await as.call('create-new-customer', {
      body: { name: 'Cliente da Subconta', cpfCnpj: '98765432100' },
    })
    expect(own.status).toBe(200)

    const p = await as.call('create-new-payment', {
      body: { customer: own.body.id, billingType: 'PIX', value: 40, dueDate: '2026-01-10' },
    })
    expect(p.status).toBe(200)

    expect((await as.call('list-payments')).body.totalCount).toBe(1)
    expect((await h.api.call('list-payments')).body.totalCount).toBe(1) // o pai continua com a dele
  })

  it('CNPJ vira conta JURIDICA', async () => {
    const res = await h.api.call('create-subaccount', {
      body: body({ cpfCnpj: '11223344000186', companyType: 'LIMITED' }),
    })
    expect(res.body.personType).toBe('JURIDICA')
    expect(res.body.companyType).toBe('LIMITED')
  })

  it('CPF com dígito verificador errado é rejeitado', async () => {
    const res = await h.api.call('create-subaccount', {
      body: body({ cpfCnpj: '11111111111' }),
    })
    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_cpfCnpj')
  })

  it('não existem duas contas com o mesmo documento', async () => {
    await h.api.call('create-subaccount', { body: body() })
    const dup = await h.api.call('create-subaccount', {
      body: body({ email: 'outra@localhost' }),
    })
    expect(dup.status).toBe(400)
    expect(dup.body.errors[0].code).toBe('invalid_cpfCnpj')
  })

  it('os webhooks informados na criação são cadastrados na subconta', async () => {
    const sub = await h.api.call('create-subaccount', {
      body: body({
        webhooks: [
          {
            name: 'Meu webhook',
            url: 'http://localhost:9999/hook',
            email: 'dev@localhost',
            sendType: 'SEQUENTIALLY',
            events: ['PAYMENT_RECEIVED'],
          },
        ],
      }),
    })

    // Ignorá-los em silêncio faria o integrador achar que assinou eventos que
    // nunca chegariam.
    const as = h.as(sub.body.apiKey)
    const list = await as.call('list-webhooks')
    expect(list.body.totalCount).toBe(1)
    expect(list.body.data[0].url).toBe('http://localhost:9999/hook')
  })
})

describe('listagem e recuperação', () => {
  it('lista só as subcontas desta conta, com filtros', async () => {
    const a = await h.api.call('create-subaccount', { body: body() })
    await h.api.call('create-subaccount', {
      body: body({ name: 'Outra Loja', cpfCnpj: '98765432100', email: 'outra@localhost' }),
    })

    const all = await h.api.call('list-subaccounts')
    expect(all.body.object).toBe('list')
    expect(all.body.totalCount).toBe(2)

    const byDoc = await h.api.call('list-subaccounts', { query: { cpfCnpj: '123.456.789-09' } })
    expect(byDoc.body.totalCount).toBe(1)
    expect(byDoc.body.data[0].id).toBe(a.body.id)

    const byWallet = await h.api.call('list-subaccounts', {
      query: { walletId: a.body.walletId },
    })
    expect(byWallet.body.totalCount).toBe(1)

    // A subconta não é dona de si mesma: ela não lista ninguém.
    const as = h.as(a.body.apiKey)
    expect((await as.call('list-subaccounts')).body.totalCount).toBe(0)
  })

  it('recupera pelo id; subconta de outra conta é 404, não 403', async () => {
    const sub = await h.api.call('create-subaccount', { body: body() })

    const one = await h.api.call('retrieve-a-single-subaccount', {
      params: { id: sub.body.id },
    })
    expect(one.body.id).toBe(sub.body.id)
    expect(one.body.walletId).toBe(sub.body.walletId)

    const other = h.as(sub.body.apiKey)
    const nope = await other.call('retrieve-a-single-subaccount', {
      params: { id: h.accountId },
    })
    expect(nope.status).toBe(404)
  })
})

describe('chaves de API da subconta', () => {
  it('cria uma chave nova, que funciona, e a lista sem NUNCA devolver o segredo', async () => {
    const sub = await h.api.call('create-subaccount', { body: body() })

    const created = await h.api.call('create-api-key-for-subaccount', {
      params: { id: sub.body.id },
      body: { name: 'Chave do CI' },
    })

    expect(created.status).toBe(200)
    expect(created.body.apiKey).toStartWith('$aact_hmlg_')
    expect(created.body.enabled).toBe(true)

    // A chave nova autentica de verdade.
    const as = h.as(created.body.apiKey)
    expect((await as.call('list-payments')).status).toBe(200)

    const list = await h.api.call('list-api-keys-for-subaccount', {
      params: { id: sub.body.id },
    })
    expect(list.body.accessTokens.length).toBe(2) // a principal + a do CI
    // O segredo não volta numa listagem. Se voltasse, ensinaríamos o integrador
    // a confiar em algo que a API real nunca entrega.
    expect(list.body.accessTokens.every((k: any) => k.apiKey === undefined)).toBe(true)
  })

  it('desabilitar a chave a mata na prática — a próxima requisição é 401', async () => {
    const sub = await h.api.call('create-subaccount', { body: body() })
    const key = await h.api.call('create-api-key-for-subaccount', {
      params: { id: sub.body.id },
      body: { name: 'Temporária' },
    })

    const as = h.as(key.body.apiKey)
    expect((await as.call('list-payments')).status).toBe(200)

    const updated = await h.api.call('update-api-key-for-a-subaccount', {
      params: { id: sub.body.id, accessTokenId: key.body.id },
      body: { name: 'Revogada', enabled: false, expirationDate: '2026-12-31 12:30:50' },
    })
    expect(updated.status).toBe(200)
    expect(updated.body.enabled).toBe(false)
    expect(updated.body.disabledReason).toBe('MANUAL')

    expect((await as.call('list-payments')).status).toBe(401)
  })

  it('excluir a chave devolve 204 e a chave para de existir', async () => {
    const sub = await h.api.call('create-subaccount', { body: body() })
    const key = await h.api.call('create-api-key-for-subaccount', {
      params: { id: sub.body.id },
      body: {},
    })

    const del = await h.api.call('delete-api-key-for-a-subaccount', {
      params: { id: sub.body.id, accessTokenId: key.body.id },
    })
    expect(del.status).toBe(204)

    expect((await h.as(key.body.apiKey).call('list-payments')).status).toBe(401)

    const list = await h.api.call('list-api-keys-for-subaccount', {
      params: { id: sub.body.id },
    })
    expect(list.body.accessTokens.length).toBe(1)
  })
})

describe('encerramento e ativação', () => {
  it('encerrar a subconta invalida as chaves dela', async () => {
    const sub = await h.api.call('create-subaccount', { body: body() })
    const as = h.as(sub.body.apiKey)
    expect((await as.call('list-payments')).status).toBe(200)

    const closed = await h.api.call('close-non-baas-subaccount', {
      params: { id: sub.body.id },
    })
    expect(closed.status).toBe(200)
    expect(closed.body.deleted).toBe(true)
    expect(closed.body.id).toBe(sub.body.id)

    expect((await as.call('list-payments')).status).toBe(401)
  })

  it('reenvio do link de ativação devolve 204', async () => {
    const sub = await h.api.call('create-subaccount', { body: body() })
    const res = await h.api.call('resend-activation-link-for-non-baas-subaccount', {
      params: { id: sub.body.id },
      body: {},
    })
    expect(res.status).toBe(204)
  })
})

describe('o fim a que tudo isto serve: o split entre conta e subconta', () => {
  it('R$ 100 no Pix com 30% para a subconta — e os dois extratos fecham', async () => {
    const sub = await h.api.call('create-subaccount', { body: body() })

    const cus = await h.api.call('create-new-customer', {
      body: { name: 'Cliente', cpfCnpj: '24971563792' },
    })

    const p = await h.api.call('create-new-payment', {
      body: {
        customer: cus.body.id,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
        split: [{ walletId: sub.body.walletId, percentualValue: 30 }],
      },
    })

    await h.api.call('confirm-payment', { params: { id: p.body.id } })
    await h.tick()

    // A subconta vê o split como RECEBIDO, com a chave DELA.
    const as = h.as(sub.body.apiKey)
    const received = await as.call('list-received-splits')

    expect(received.body.totalCount).toBe(1)
    expect(received.body.data[0].totalValue).toBe(29.4) // 30% de 98,01
    expect(received.body.data[0].destinationAccountId).toBe(sub.body.id)
    expect(received.body.data[0].status).toBe('DONE')

    await h.assertLedgerBalances()
  })
})
