/**
 * O painel e a introspecção de contas.
 *
 * `GET /_admin/accounts` devolve as CHAVES DE API de todas as contas — algo que a
 * API do Asaas jamais faria. É aceitável porque isto é um simulador de localhost,
 * mas só enquanto estiver de fato trancado atrás de `ADMIN_ENABLED`. É isso que o
 * último teste deste arquivo existe para garantir: se alguém mover a rota para
 * fora do bloco do admin, o teste quebra.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { createHarness, type Harness } from '../helpers/harness.ts'

let h: Harness
afterEach(() => h?.close())

const get = (app: Harness['app'], path: string) =>
  app.app.handle(new Request(`http://localhost${path}`))

describe('painel', () => {
  it('é servido na raiz, como HTML', async () => {
    h = await createHarness()
    const res = await get(h.app, '/')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('Asaas Mock')
  })

  /**
   * O PAINEL TEM QUE SER UM ARQUIVO SÓ. É a regressão que o build de front introduziu,
   * e ela é silenciosa da pior forma.
   *
   * O servidor serve UM arquivo: `src/admin/ui.html`. Não há rota de estáticos. Se
   * alguém mexer no `vite.config.ts` e tirar o `viteSingleFile`, o Vite passa a emitir
   * `<script src="/assets/index-a1b2c3.js">` — que o servidor não conhece. O HTML
   * continua respondendo 200, o teste acima continua passando, e o painel abre EM
   * BRANCO no container de todo mundo.
   */
  it('é autocontido: nenhum asset externo, ou o painel abre em branco no container', async () => {
    h = await createHarness()
    const html = await (await get(h.app, '/')).text()

    // O JS e o CSS têm que estar INLINE.
    expect(html).toContain('<script')
    expect(html).not.toMatch(/<script[^>]+src=["']\/(assets|src)\//)
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']\/(assets|src)\//)

    // E o bundle tem que ter de fato entrado: um HTML com a casca e sem o app
    // passaria nos asserts acima.
    expect(html.length).toBeGreaterThan(20_000)
  })

  /**
   * As rotas de que o painel VIVE. Se uma sumir, a tela carrega e fica vazia — sem
   * erro no console do servidor, sem nada. É o tipo de quebra que só aparece quando
   * alguém abre o painel, que pode ser semanas depois.
   */
  it('as rotas que o painel consome existem', async () => {
    h = await createHarness()
    const account = h.app.seed.accountId

    for (const path of [
      '/_admin/accounts',
      '/_admin/clock',
      '/_admin/test-cards',
      '/_admin/webhooks/queue',
      `/_admin/summary?accountId=${account}`,
    ]) {
      const res = await get(h.app, path)
      expect(res.status, `${path} deveria responder 200`).toBe(200)
    }
  })

  it('lista as contas com saldo e chave — inclusive as subcontas', async () => {
    h = await createHarness()

    await h.api.call('create-subaccount', {
      body: {
        name: 'Loja Parceira',
        email: 'loja@localhost',
        cpfCnpj: '24971563792',
        mobilePhone: '47996321478',
        incomeValue: 25000,
        address: 'Rua A',
        addressNumber: '1',
        province: 'Centro',
        postalCode: '14079-452',
      },
    })

    const body = (await (await get(h.app, '/_admin/accounts')).json()) as any
    expect(body.accounts.length).toBe(2)

    const principal = body.accounts.find((a: any) => !a.parentAccountId)
    const sub = body.accounts.find((a: any) => a.parentAccountId)

    expect(principal.id).toBe(h.accountId)
    expect(sub.parentAccountId).toBe(h.accountId)

    // O que o painel precisa de cada conta, e que a API do Asaas não dá:
    for (const a of [principal, sub]) {
      expect(a.apiKey).toStartWith('$aact_hmlg_')
      expect(a.walletId).toBeString()
      expect(a.balance).toBe(0) // em REAIS, não centavos
    }

    // Carteiras distintas — é o que faz o split ter para onde ir.
    expect(sub.walletId).not.toBe(principal.walletId)
  })

  it('o saldo vem em REAIS, e acompanha o ledger', async () => {
    h = await createHarness()

    const customer = await h.api.call('create-new-customer', {
      body: { name: 'Fulano', cpfCnpj: '24971563792' },
    })
    const pay = await h.api.call('create-new-payment', {
      body: {
        customer: customer.body.id,
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-01-10',
      },
    })
    await h.api.call('confirm-payment', { params: { id: pay.body.id } })

    const body = (await (await get(h.app, '/_admin/accounts')).json()) as any
    const principal = body.accounts.find((a: any) => !a.parentAccountId)

    // 100 − 1,99 de taxa do Pix. Em reais: o painel exibe direto.
    expect(principal.balance).toBe(98.01)
    await h.assertLedgerBalances()
  })

  it('com ADMIN_ENABLED=false, o painel some e as chaves não vazam', async () => {
    h = await createHarness({ adminEnabled: false })

    // A rota do painel nem é montada.
    expect((await get(h.app, '/')).status).toBe(404)

    // E o endpoint que expõe as chaves recusa.
    const res = await get(h.app, '/_admin/accounts')
    expect(res.status).toBeGreaterThanOrEqual(400)

    const body = (await res.json()) as any
    expect(JSON.stringify(body)).not.toContain('$aact_')
  })
})
