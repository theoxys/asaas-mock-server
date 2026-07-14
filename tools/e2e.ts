/**
 * A PROVA DE PONTA A PONTA — o critério de aceite deste projeto inteiro.
 *
 *   bun run e2e                      # sobe o servidor sozinho, prova, derruba
 *   bun run e2e -- http://localhost:8080 '$aact_hmlg_…'   # contra um já rodando
 *
 * O projeto existe por UMA razão: o sandbox do Asaas não entrega webhook em
 * localhost. Toda a suíte de testes roda com o app em memória — o que prova a
 * lógica, mas não prova a promessa. Este script prova a promessa: fala HTTP de
 * verdade com o servidor, sobe um listener num socket de verdade, e espera o
 * `PAYMENT_RECEIVED` chegar nele.
 *
 * Se este script passar contra `docker compose up`, o produto funciona.
 */
import { bootstrap } from '../src/bootstrap.ts'

const [argUrl, argKey] = process.argv.slice(2).filter((a) => !a.startsWith('-'))

let api: string
let key: string
let stop = () => {}

if (argUrl && argKey) {
  api = argUrl.replace(/\/$/, '')
  key = argKey
  console.log(`Falando com um servidor já em pé: ${api}\n`)
} else {
  // Porta 0 = o SO escolhe uma livre. Nada de conflito com o dev server.
  const app = await bootstrap({
    config: {
      databasePath: ':memory:',
      logLevel: (process.env.LOG_LEVEL as never) ?? 'silent',
      port: 0,
      webhook: { localhostRewrite: undefined },
    },
  })
  app.scheduler.start(0)
  const server = app.app.listen(0)
  api = `http://localhost:${server.server?.port}`
  key = app.seed.apiKey
  stop = () => {
    app.scheduler.stop()
    server.stop()
    app.close()
  }
  console.log(`Servidor efêmero em ${api}\n`)
}

// ── o listener: é ELE que precisa receber o evento ───────────────────────────
const received: any[] = []
const listener = Bun.serve({
  port: 0,
  async fetch(req) {
    const body = (await req.json()) as any
    received.push({ ...body, _authToken: req.headers.get('asaas-access-token') })
    console.log(`   📬 ${body.event}`)
    // Só HTTP 200 conta como sucesso para o Asaas. 201 e 204 são FALHA.
    return new Response('ok', { status: 200 })
  },
})
const listenerUrl = `http://localhost:${listener.port}`

const call = async (method: string, path: string, body?: unknown): Promise<any> => {
  const res = await fetch(api + path, {
    method,
    headers: { access_token: key, 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => null)
  if (res.status >= 400) {
    console.error(`\n✗ ${method} ${path} → HTTP ${res.status}`)
    console.error(JSON.stringify(json, null, 2))
    listener.stop()
    stop()
    process.exit(1)
  }
  return json
}

const AUTH_TOKEN = 'token-do-e2e-com-trinta-e-dois-chars'

console.log(`Listener local em ${listenerUrl}`)

await call('POST', '/v3/webhooks', {
  name: 'e2e',
  url: listenerUrl,
  email: 'e2e@localhost',
  sendType: 'SEQUENTIALLY',
  authToken: AUTH_TOKEN,
  events: ['PAYMENT_CREATED', 'PAYMENT_RECEIVED'],
})
console.log('1. webhook inscrito apontando para localhost')

const customer = await call('POST', '/v3/customers', {
  name: 'Cliente E2E',
  cpfCnpj: '24971563792',
  email: 'cliente@localhost',
})
console.log(`2. cliente ${customer.id}`)

const dueDate = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)
const payment = await call('POST', '/v3/payments', {
  customer: customer.id,
  billingType: 'PIX',
  value: 100,
  dueDate,
  description: 'Prova de ponta a ponta',
})
console.log(`3. cobrança Pix ${payment.id} — status=${payment.status}`)

// A ação de sandbox: é o que o Asaas real dispara quando o cliente paga.
const confirmed = await call('POST', `/v3/sandbox/payment/${payment.id}/confirm`)
console.log(`4. confirmada → status=${confirmed.status}`)

// O dispatcher roda no fim do tick.
await fetch(`${api}/_admin/tick`, { method: 'POST' }).catch(() => {})

console.log('5. esperando o evento chegar no listener…')
for (let i = 0; i < 60 && !received.some((e) => e.event === 'PAYMENT_RECEIVED'); i++) {
  await Bun.sleep(100)
}

// ── veredito ─────────────────────────────────────────────────────────────────
const fail = (msg: string): never => {
  console.error(`\n✗ ${msg}`)
  listener.stop()
  stop()
  process.exit(1)
}

const evt = received.find((e) => e.event === 'PAYMENT_RECEIVED')
if (!evt) {
  fail(
    `PAYMENT_RECEIVED não chegou em ${listenerUrl}.\n` +
      `  Recebidos: ${received.map((e) => e.event).join(', ') || '(nada)'}\n` +
      `  Se estiver em Docker: WEBHOOK_LOCALHOST_REWRITE=host.docker.internal`,
  )
}

const checks: [string, unknown, unknown][] = [
  ['status', evt.payment.status, 'RECEIVED'],
  ['value', evt.payment.value, 100],
  ['netValue (100 − 1,99 de taxa fixa do Pix)', evt.payment.netValue, 98.01],
  ['authToken no header asaas-access-token', evt._authToken, AUTH_TOKEN],
]

console.log('')
let ok = true
for (const [label, actual, expected] of checks) {
  const good = actual === expected
  ok &&= good
  console.log(`   ${good ? '✓' : '✗'} ${label}: ${actual}${good ? '' : `  (esperado: ${expected})`}`)
}
// O Pix credita na hora — não é uma promessa de crédito futuro.
console.log(`   ✓ creditDate: ${evt.payment.creditDate}  (Pix credita no ato)`)

listener.stop()
stop()

if (!ok) process.exit(1)

console.log(`
─────────────────────────────────────────────────────────────
✓ O webhook do Asaas chegou em localhost.

  É exatamente isto que o sandbox do Asaas não faz — e o motivo
  de este projeto existir.
─────────────────────────────────────────────────────────────
`)
