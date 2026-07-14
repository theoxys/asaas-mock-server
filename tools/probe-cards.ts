/**
 * Pergunta ao sandbox REAL do Asaas o que cada número de cartão faz.
 *
 *   ASAAS_SANDBOX_API_KEY='$aact_hmlg_…' bun tools/probe-cards.ts
 *
 * Existe porque a documentação do Asaas lista uns poucos cartões de teste sem
 * dizer QUAL erro cada um produz — e "recusado" não é um erro só: antifraude,
 * saldo insuficiente, cartão expirado e CVV errado são desfechos diferentes, com
 * códigos diferentes, e uma aplicação séria trata cada um de um jeito.
 *
 * O roteiro cria uma cobrança de verdade no sandbox e tenta pagá-la com cada
 * número. Grava o par (número → resposta crua) em `tests/golden/probes/card-probe.json`.
 * O que a resposta disser é a verdade; o que a doc disser é palpite.
 */
const apiKey = process.env.ASAAS_SANDBOX_API_KEY ?? ''
const BASE = 'https://api-sandbox.asaas.com/v3'

// A MESMA guarda do capture.ts: uma chave de produção criaria cobranças reais.
if (!apiKey.startsWith('$aact_hmlg_')) {
  console.error('A chave não parece ser de sandbox (deveria começar com "$aact_hmlg_").')
  process.exit(1)
}

/**
 * Os candidatos. Vêm de três lugares: a doc do Asaas, os números que já estão no
 * nosso mock, e os cartões de teste "canônicos" das bandeiras (Visa 4000…0002 é
 * o "generic decline" universal — vale saber se o Asaas os reconhece).
 */
const CANDIDATES: Array<{ number: string; hunch: string }> = [
  { number: '5162306219378829', hunch: 'doc do Asaas — aprovado' },
  { number: '4444444444444444', hunch: 'nosso mock — aprovado (não passa no Luhn!)' },
  { number: '5184019740373151', hunch: 'nosso mock — recusado' },
  { number: '4916561358240741', hunch: 'nosso mock — recusado' },
  { number: '4000000000000002', hunch: 'canônico — generic decline' },
  { number: '4000000000009995', hunch: 'canônico — insufficient funds' },
  { number: '4000000000000069', hunch: 'canônico — expired card' },
  { number: '4000000000000127', hunch: 'canônico — incorrect CVC' },
  { number: '4000000000000119', hunch: 'canônico — processing error' },
  { number: '4111111111111111', hunch: 'Visa de teste clássico (passa no Luhn)' },
]

const HOLDER = {
  name: 'Marcelo H V Almeida',
  email: 'marcelo.almeida@gmail.com',
  cpfCnpj: '24971563792',
  postalCode: '89223-005',
  addressNumber: '277',
  phone: '4738010919',
}

async function api(path: string, init?: RequestInit) {
  const r = await fetch(BASE + path, {
    ...init,
    headers: {
      access_token: apiKey,
      'content-type': 'application/json',
      'User-Agent': 'asaas-mock-server/probe',
      ...(init?.headers ?? {}),
    },
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

async function main() {
  const customer = await api('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: 'Probe Cartões', cpfCnpj: '24971563792' }),
  })
  const customerId = (customer.body as { id?: string })?.id
  if (!customerId) throw new Error(`não criou o cliente: ${JSON.stringify(customer.body)}`)
  console.log('cliente:', customerId, '\n')

  const results: unknown[] = []

  for (const { number, hunch } of CANDIDATES) {
    // Cada cartão precisa da SUA cobrança: uma cobrança já paga não aceita
    // segunda tentativa, e uma recusada pode entrar em estado de retentativa.
    const payment = await api('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: 100.0,
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        description: `probe ${number.slice(-4)}`,
      }),
    })
    const paymentId = (payment.body as { id?: string })?.id
    if (!paymentId) {
      console.log(`${number}  ✗ não criou a cobrança:`, JSON.stringify(payment.body))
      continue
    }

    const pay = await api(`/payments/${paymentId}/payWithCreditCard`, {
      method: 'POST',
      body: JSON.stringify({
        creditCard: {
          holderName: HOLDER.name,
          number,
          expiryMonth: '05',
          expiryYear: '2035',
          ccv: '318',
        },
        creditCardHolderInfo: HOLDER,
        remoteIp: '116.213.42.98',
      }),
    })

    const b = pay.body as { status?: string; errors?: Array<{ code: string; description: string }> }
    const verdict =
      pay.status === 200
        ? `HTTP 200  status=${b?.status}`
        : `HTTP ${pay.status}  ${b?.errors?.map((e) => `${e.code}: ${e.description}`).join(' | ')}`

    console.log(`${number}  ${verdict}`)
    console.log(`${' '.repeat(number.length)}  (palpite: ${hunch})\n`)

    results.push({ number, hunch, httpStatus: pay.status, response: pay.body })
  }

  await Bun.write('tests/golden/probes/card-probe.json', JSON.stringify(results, null, 2) + '\n')
  console.log('gravado em tests/golden/probes/card-probe.json')
}

await main()
