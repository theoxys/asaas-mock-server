/**
 * O ciclo de "memorizar cartão", perguntado ao sandbox REAL.
 *
 *   ASAAS_SANDBOX_API_KEY='$aact_hmlg_…' bun tools/probe-tokenization.ts
 *
 * Tokenização é a feature em que um mock "quase certo" custa mais caro: ela
 * funciona no teste, o usuário salva o cartão, e a segunda compra falha em
 * produção por um campo que o sandbox exigia e o mock não. Então nada aqui é
 * deduzido — cada pergunta vira uma requisição de verdade:
 *
 *   1. O que exatamente `tokenizeCreditCard` devolve?
 *   2. Dá para cobrar SÓ com o token, sem o número? (é a feature inteira)
 *   3. O CVV é exigido na segunda compra?
 *   4. O token é preso ao CLIENTE que o criou, ou serve para qualquer um?
 *   5. Uma cobrança paga com cartão devolve um token reutilizável?
 *   6. Token inválido: que erro?
 *   7. O token sobrevive à recusa? (tokenizar um cartão que recusa)
 */
/**
 * Aponte para o MOCK (`BASE=http://localhost:45445/v3`) e o mesmo roteiro roda
 * contra ele. Rodar os dois e diferenciar as saídas é o teste inteiro: qualquer
 * linha que mude é uma divergência, e o Asaas é a verdade.
 */
const BASE = process.env.BASE ?? 'https://api-sandbox.asaas.com/v3'
const apiKey = process.env.ASAAS_SANDBOX_API_KEY ?? ''
const againstMock = !BASE.includes('asaas.com')

// A guarda só vale para o Asaas de verdade: uma chave de produção criaria
// cobranças reais. Contra o mock, qualquer chave serve.
if (!againstMock && !apiKey.startsWith('$aact_hmlg_')) {
  console.error('Chave de SANDBOX obrigatória (começa com "$aact_hmlg_").')
  process.exit(1)
}

const HOLDER_INFO = {
  name: 'Marcelo H V Almeida',
  email: 'marcelo.almeida@gmail.com',
  cpfCnpj: '24971563792',
  postalCode: '89223-005',
  addressNumber: '277',
  phone: '4738010919',
}
const CARD = {
  holderName: 'Marcelo H V Almeida',
  number: '5162306219378829',
  expiryMonth: '05',
  expiryYear: '2035',
  ccv: '318',
}
const IP = '116.213.42.98'

async function api(path: string, body?: unknown, method = 'POST') {
  const r = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : method,
    headers: { access_token: apiKey, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: r.status, body: (await r.json().catch(() => null)) as any }
}

const show = (label: string, r: { status: number; body: any }) => {
  const err = r.body?.errors?.map((e: any) => `[${e.code}] ${e.description}`).join(' | ')
  console.log(`${label}\n   HTTP ${r.status}  ${err ?? ''}`)
}

const customer = async (name: string) =>
  (await api('/customers', { name, cpfCnpj: '24971563792' })).body.id as string

const payment = async (customerId: string) =>
  (
    await api('/payments', {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: 100,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    })
  ).body.id as string

const out: Record<string, unknown> = {}

// ── 1. o que a tokenização devolve ──────────────────────────────────────────
const cusA = await customer('Token A')
const tok = await api('/creditCard/tokenizeCreditCard', {
  customer: cusA,
  creditCard: CARD,
  creditCardHolderInfo: HOLDER_INFO,
  remoteIp: IP,
})
console.log('1. tokenizeCreditCard')
console.log('   →', JSON.stringify(tok.body, null, 2).replace(/\n/g, '\n   '), '\n')
out.tokenize = { status: tok.status, body: tok.body }

const token = tok.body?.creditCardToken as string

// ── 2. cobrar SÓ com o token (a feature inteira) ────────────────────────────
const p2 = await payment(cusA)
const r2 = await api(`/payments/${p2}/payWithCreditCard`, { creditCardToken: token, remoteIp: IP })
show('2. pagar com creditCardToken, SEM número e SEM ccv', r2)
console.log('   creditCard devolvido:', JSON.stringify(r2.body?.creditCard), '\n')
out.payWithTokenOnly = { status: r2.status, creditCard: r2.body?.creditCard, status_: r2.body?.status }

// ── 3. o CVV é exigido na recompra? ─────────────────────────────────────────
const p3 = await payment(cusA)
const r3 = await api(`/payments/${p3}/payWithCreditCard`, {
  creditCardToken: token,
  creditCard: { ccv: '318' },
  remoteIp: IP,
})
show('3. token + ccv (alguns PSPs exigem o CVV na recompra)', r3)
console.log()
out.payWithTokenAndCcv = { status: r3.status }

// ── 4. o token é preso ao cliente que o criou? ──────────────────────────────
const cusB = await customer('Token B — OUTRO cliente')
const p4 = await payment(cusB)
const r4 = await api(`/payments/${p4}/payWithCreditCard`, { creditCardToken: token, remoteIp: IP })
show('4. usar o token do cliente A para cobrar o cliente B', r4)
console.log('   → se der 200, o token NÃO é preso ao cliente\n')
out.tokenCrossCustomer = { status: r4.status, body: r4.body?.errors ?? r4.body?.status }

// ── 5. a cobrança com cartão devolve token reutilizável? ────────────────────
const cusC = await customer('Token C')
const p5 = await api('/payments', {
  customer: cusC,
  billingType: 'CREDIT_CARD',
  value: 100,
  dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  creditCard: CARD,
  creditCardHolderInfo: HOLDER_INFO,
  remoteIp: IP,
})
const bornToken = p5.body?.creditCard?.creditCardToken
console.log('5. POST /payments com creditCard devolve token?')
console.log('   creditCard:', JSON.stringify(p5.body?.creditCard))
const p5b = await payment(cusC)
const r5b = await api(`/payments/${p5b}/payWithCreditCard`, {
  creditCardToken: bornToken,
  remoteIp: IP,
})
show('   e esse token cobra de novo?', r5b)
console.log()
out.tokenFromPayment = { token: !!bornToken, reusable: r5b.status }

// ── 6. token inexistente ────────────────────────────────────────────────────
const p6 = await payment(cusA)
const r6 = await api(`/payments/${p6}/payWithCreditCard`, {
  creditCardToken: 'nao-existe-este-token',
  remoteIp: IP,
})
show('6. token inexistente', r6)
console.log()
out.badToken = { status: r6.status, errors: r6.body?.errors }

// ── 7. tokenizar um cartão que RECUSA ───────────────────────────────────────
const cusD = await customer('Token D')
const r7 = await api('/creditCard/tokenizeCreditCard', {
  customer: cusD,
  creditCard: { ...CARD, number: '5184019740373151' },
  creditCardHolderInfo: HOLDER_INFO,
  remoteIp: IP,
})
show('7. tokenizar o cartão de RECUSA (a tokenização autoriza?)', r7)
if (r7.status === 200) {
  const p7 = await payment(cusD)
  const r7b = await api(`/payments/${p7}/payWithCreditCard`, {
    creditCardToken: r7.body.creditCardToken,
    remoteIp: IP,
  })
  show('   → e o token dele recusa quando cobrado?', r7b)
}
console.log()
out.tokenizeDeclined = { status: r7.status, errors: r7.body?.errors }

await Bun.write(process.env.OUT ?? 'tests/golden/probes/tokenization-probe.json', JSON.stringify(out, null, 2) + '\n')
console.log('gravado em tests/golden/probes/tokenization-probe.json')
