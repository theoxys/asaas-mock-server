/**
 * KYC / onboarding: os documentos da conta e a ação de sandbox que a aprova.
 *
 * O fluxo inteiro do cliente cabe num teste: cria a subconta, descobre o
 * documento pendente, envia o arquivo (multipart de verdade, com um Blob), vê o
 * documento ser aprovado, e vê `GET /v3/myAccount/status` fechar em APPROVED.
 *
 * SOBRE `responsible.type`: a spec declara ARRAY; o sandbox real devolve STRING.
 * Devolvemos string — o golden ganha (AGENTS.md) —, e `spec/overlays/006` conserta
 * a spec, de modo que a validação de contrato do harness volta a valer aqui. Sem
 * o overlay, o simulador teria de escolher entre estar certo e passar no próprio
 * contrato.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createHarness, TEST_API_KEY, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

const subaccountBody = {
  name: 'Loja do Fulano',
  email: 'loja@localhost',
  cpfCnpj: '12345678909',
  mobilePhone: '11999998888',
  incomeValue: 25000,
  address: 'Rua Fernando Orlandi',
  addressNumber: '544',
  province: 'Jardim Pedra Branca',
  postalCode: '14079-452',
}

/** `GET /v3/myAccount/documents` — pelo ApiClient, com validação de contrato. */
async function getDocuments(apiKey: string): Promise<any> {
  const res = await h.as(apiKey).call('check-pending-documents', {})
  expect(res.status).toBe(200)
  return res.body
}

/** O upload que o cliente faz: multipart/form-data com o campo `documentFile`. */
async function upload(
  apiKey: string,
  documentId: string,
  file: Blob | null = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
): Promise<{ status: number; body: any }> {
  const fd = new FormData()
  if (file) fd.append('documentFile', file, 'identidade.png')

  const res = await h.app.app.handle(
    new Request(`http://localhost/v3/myAccount/documents/${documentId}`, {
      method: 'POST',
      headers: { access_token: apiKey },
      body: fd,
    }),
  )

  return { status: res.status, body: await res.json() }
}

async function newSubaccount(): Promise<{ apiKey: string; id: string }> {
  const res = await h.api.call('create-subaccount', { body: subaccountBody })
  expect(res.status).toBe(200)
  return { apiKey: res.body.apiKey, id: res.body.id }
}

describe('listagem de documentos', () => {
  it('a conta principal nasce aprovada — e o grupo APPROVED não traz `documents`', async () => {
    const body = await getDocuments(TEST_API_KEY)

    expect(body.rejectReasons).toBeNull()
    expect(body.data).toHaveLength(1)

    const [group] = body.data
    expect(group.status).toBe('APPROVED')
    expect(group.type).toBe('IDENTIFICATION')
    expect(group.title).toBe('Documentos de identificação')
    expect(group.responsible).toEqual({
      name: 'Conta de Teste',
      type: 'INDIVIDUAL_COMPANY',
    })

    // É o que o sandbox real devolve para uma conta aprovada: link nulo, e NEM
    // `documents` NEM `onboardingUrlExpirationDate` na resposta.
    expect(group.onboardingUrl).toBeNull()
    expect(group).not.toHaveProperty('documents')
    expect(group).not.toHaveProperty('onboardingUrlExpirationDate')
  })

  it('a subconta nasce com documento pendente, com id e link de onboarding', async () => {
    const sub = await newSubaccount()
    const body = await getDocuments(sub.apiKey)

    expect(body.data).toHaveLength(1)
    const [group] = body.data

    expect(group.status).toBe('NOT_SENT')
    expect(group.type).toBe('IDENTIFICATION')
    // FISICA: quem responde pelo documento é o dono da conta.
    expect(group.responsible).toEqual({ name: 'Loja do Fulano', type: 'ASAAS_ACCOUNT_OWNER' })

    expect(group.onboardingUrl).toBeString()
    expect(group.onboardingUrlExpirationDate).toBeString()

    // É daqui que o cliente tira o `documentId` do upload.
    expect(group.documents).toHaveLength(1)
    expect(group.documents[0].id).toBeString()
    expect(group.documents[0].status).toBe('NOT_SENT')
  })

  it('cada conta só enxerga os próprios documentos', async () => {
    const sub = await newSubaccount()

    const mine = await getDocuments(TEST_API_KEY)
    const theirs = await getDocuments(sub.apiKey)

    expect(mine.data[0].id).not.toBe(theirs.data[0].id)
  })
})

describe('envio de documento (multipart)', () => {
  it('o fluxo inteiro: subconta → documento pendente → upload → conta aprovada', async () => {
    const sub = await newSubaccount()
    const as = h.as(sub.apiKey)

    // 1. A subconta transaciona, mas o KYC está pendente.
    const before = await as.call('check-account-registration-status')
    expect(before.body.commercialInfo).toBe('APPROVED')
    expect(before.body.documentation).toBe('PENDING')
    expect(before.body.general).toBe('PENDING')

    // 2. O cliente descobre qual documento enviar.
    const pending = await getDocuments(sub.apiKey)
    const documentId = pending.data[0].documents[0].id

    // 3. Envia a imagem. Em sandbox qualquer arquivo é aceito e auto-aprovado.
    const sent = await upload(sub.apiKey, documentId)
    expect(sent.status).toBe(200)
    expect(sent.body).toEqual({ id: documentId, status: 'APPROVED' })

    // 4. Era o último documento do grupo: o grupo inteiro é aprovado — e passa a
    //    responder como um grupo aprovado responde (sem `documents`, sem link).
    const after = await getDocuments(sub.apiKey)
    expect(after.data[0].status).toBe('APPROVED')
    expect(after.data[0].onboardingUrl).toBeNull()
    expect(after.data[0]).not.toHaveProperty('documents')

    // 5. E o status da conta fecha sozinho.
    const status = await as.call('check-account-registration-status')
    expect(status.body.documentation).toBe('APPROVED')
    expect(status.body.general).toBe('APPROVED')
  })

  it('sem `documentFile` → 400, porque o multipart não passa pelo TypeBox', async () => {
    const sub = await newSubaccount()
    const pending = await getDocuments(sub.apiKey)

    const res = await upload(sub.apiKey, pending.data[0].documents[0].id, null)

    expect(res.status).toBe(400)
    expect(res.body.errors[0].code).toBe('invalid_documentFile')
  })

  it('documento inexistente → 404', async () => {
    const res = await upload(TEST_API_KEY, 'nao-existe')

    expect(res.status).toBe(404)
    expect(res.body.errors[0].code).toBe('not_found')
  })

  it('o documento de OUTRA conta é um 404, não um 403', async () => {
    const sub = await newSubaccount()
    const pending = await getDocuments(sub.apiKey)
    const alheio = pending.data[0].documents[0].id

    // A conta pai NÃO envia documento pela subconta, mesmo tendo-a criado.
    const res = await upload(TEST_API_KEY, alheio)
    expect(res.status).toBe(404)

    // E o documento da subconta continua intacto.
    const still = await getDocuments(sub.apiKey)
    expect(still.data[0].documents[0].status).toBe('NOT_SENT')
  })
})

describe('aprovação da conta (sandbox)', () => {
  it('aprova a conta e todos os documentos de uma vez', async () => {
    const sub = await newSubaccount()
    const as = h.as(sub.apiKey)

    const res = await as.call('approve-account', { body: {} })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      id: sub.id,
      commercialInfo: 'APPROVED',
      bankAccountInfo: 'APPROVED',
      documentation: 'APPROVED',
      general: 'APPROVED',
    })

    // Não é só o status: os documentos que estavam NOT_SENT foram aprovados.
    const docs = await getDocuments(sub.apiKey)
    expect(docs.data[0].status).toBe('APPROVED')
    expect(docs.data[0]).not.toHaveProperty('documents')

    // E `GET /v3/myAccount/status` concorda com a resposta da aprovação.
    const status = await as.call('check-account-registration-status')
    expect(status.body.general).toBe('APPROVED')
  })

  it('aprovar de novo não quebra nada', async () => {
    const sub = await newSubaccount()
    const as = h.as(sub.apiKey)

    await as.call('approve-account', { body: {} })
    const again = await as.call('approve-account', { body: {} })

    expect(again.status).toBe(200)
    expect(again.body.general).toBe('APPROVED')
  })

  it('aprova SÓ a conta autenticada', async () => {
    const a = await newSubaccount()
    const b = await newSubaccount2()

    await h.as(a.apiKey).call('approve-account', { body: {} })

    const other = await getDocuments(b.apiKey)
    expect(other.data[0].status).toBe('NOT_SENT')
  })
})

/** Uma segunda subconta — o CPF/CNPJ é único por conta. */
async function newSubaccount2(): Promise<{ apiKey: string; id: string }> {
  const res = await h.api.call('create-subaccount', {
    body: { ...subaccountBody, cpfCnpj: '11144477735', email: 'outra@localhost' },
  })
  expect(res.status).toBe(200)
  return { apiKey: res.body.apiKey, id: res.body.id }
}

