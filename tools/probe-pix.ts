/**
 * O ciclo do PIX, perguntado ao sandbox REAL — e ao mock, com o mesmo roteiro.
 *
 *   ASAAS_SANDBOX_API_KEY='$aact_hmlg_…' bun tools/probe-pix.ts
 *   BASE=http://localhost:45445/v3 ASAAS_SANDBOX_API_KEY='qualquer' bun tools/probe-pix.ts
 *
 * As perguntas:
 *
 *   1. O que `POST /payments` com PIX devolve? (status inicial)
 *   2. O QR Code: quais campos, e o payload é um BR Code de verdade?
 *   3. `POST /v3/sandbox/payment/{id}/confirm` — é ISTO que simula o pagamento?
 *      É o que o botão "simular pagamento" do painel do Asaas faz?
 *   4. Depois de pago: status, netValue, creditDate, confirmedDate, paymentDate.
 *      (o PIX credita NA HORA — se a data de crédito não for hoje, erramos)
 *   5. O extrato mexe? Quais lançamentos?
 *   6. Confirmar DUAS vezes: o que acontece?
 */
const BASE = process.env.BASE ?? 'https://api-sandbox.asaas.com/v3'
const apiKey = process.env.ASAAS_SANDBOX_API_KEY ?? ''
const againstMock = !BASE.includes('asaas.com')

if (!againstMock && !apiKey.startsWith('$aact_hmlg_')) {
  console.error('Chave de SANDBOX obrigatória (começa com "$aact_hmlg_").')
  process.exit(1)
}

async function api(path: string, body?: unknown) {
  const r = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { access_token: apiKey, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: r.status, body: (await r.json().catch(() => null)) as any }
}

const today = new Date().toISOString().slice(0, 10)
const cus = (await api('/customers', { name: 'Probe PIX', cpfCnpj: '24971563792' })).body.id

// ── 1. criar ────────────────────────────────────────────────────────────────
const created = await api('/payments', {
  customer: cus,
  billingType: 'PIX',
  value: 250.0,
  dueDate: today,
})
const p = created.body
console.log('1. POST /payments (PIX)')
console.log(`   status=${p.status}  value=${p.value}  netValue=${p.netValue}`)
console.log(`   dueDate=${p.dueDate}  creditDate=${p.creditDate ?? '—'}\n`)

// ── 2. o QR Code ────────────────────────────────────────────────────────────
const qr = await api(`/payments/${p.id}/pixQrCode`)
const q = qr.body
console.log('2. GET /payments/{id}/pixQrCode')
console.log(`   campos: ${Object.keys(q ?? {}).join(', ')}`)
console.log(`   payload começa com: ${String(q?.payload ?? '').slice(0, 24)}…`)
console.log(`   encodedImage: ${q?.encodedImage ? `base64, ${q.encodedImage.length} chars` : '—'}`)
console.log(`   expirationDate: ${q?.expirationDate ?? '—'}\n`)

// ── 3. simular o pagamento ──────────────────────────────────────────────────
const confirmed = await api(`/sandbox/payment/${p.id}/confirm`, {})
console.log('3. POST /v3/sandbox/payment/{id}/confirm  ← o "simular pagamento"')
console.log(`   HTTP ${confirmed.status}`)
if (confirmed.status !== 200) {
  console.log(`   ${JSON.stringify(confirmed.body)}\n`)
} else {
  console.log(`   campos da resposta: ${Object.keys(confirmed.body ?? {}).slice(0, 12).join(', ')}\n`)
}

// ── 4. o estado depois ──────────────────────────────────────────────────────
const after = (await api(`/payments/${p.id}`)).body
console.log('4. a cobrança, depois de paga')
for (const k of [
  'status',
  'value',
  'netValue',
  'creditDate',
  'confirmedDate',
  'paymentDate',
  'clientPaymentDate',
  'estimatedCreditDate',
]) {
  console.log(`   ${k.padEnd(20)} ${JSON.stringify(after?.[k])}`)
}
console.log()

// ── 5. o extrato ────────────────────────────────────────────────────────────
const tx = await api('/financialTransactions?limit=5')
console.log('5. extrato')
for (const t of tx.body?.data ?? []) {
  console.log(`   ${t.date}  ${String(t.type).padEnd(22)} ${String(t.value).padStart(8)}`)
}
console.log()

// ── 6. confirmar de novo ────────────────────────────────────────────────────
const again = await api(`/sandbox/payment/${p.id}/confirm`, {})
console.log('6. confirmar DUAS vezes')
console.log(
  `   HTTP ${again.status}  ` +
    (again.body?.errors?.map((e: any) => `[${e.code}] ${e.description}`).join(' | ') ??
      `status=${again.body?.status}`),
)
