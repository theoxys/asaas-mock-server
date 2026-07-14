/**
 * As duas portas do painel — e a distinção entre elas é o ponto do projeto.
 *
 * `v3()` é a API REAL do Asaas, chamada com a chave de uma conta. Todo botão que
 * representa algo que o Asaas de verdade faz passa por aqui: confirmar um
 * pagamento no sandbox, religar um webhook, criar uma subconta. O botão exercita o
 * MESMO caminho que o código do usuário vai exercitar.
 *
 * `admin()` é a introspecção do simulador — viagem no tempo, fila de entregas,
 * chaves de todas as contas. Nada disso existe no Asaas, e por isso mora fora de
 * /v3 e aparece na tela sob a marca "Simulador".
 *
 * Quando as duas se confundem, o painel vira uma mentira útil: você aperta um botão
 * que só existe aqui e sai achando que a sua integração funciona.
 */

export interface AsaasError {
  code: string
  description: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: AsaasError[] = [],
  ) {
    super(message)
  }
}

async function parse(r: Response): Promise<any> {
  if (r.status === 204) return null
  const body = await r.json().catch(() => null)
  if (!r.ok) {
    const errors: AsaasError[] = body?.errors ?? []
    throw new ApiError(errors[0]?.description ?? `HTTP ${r.status}`, r.status, errors)
  }
  return body
}

/** Introspecção do simulador. Não existe no Asaas. */
export async function admin(path: string, init?: RequestInit): Promise<any> {
  return parse(
    await fetch(`/_admin${path}`, {
      headers: { 'content-type': 'application/json' },
      ...init,
    }),
  )
}

/** A API v3 do Asaas, COMO a conta dona da chave. */
export async function v3(path: string, apiKey: string, init?: RequestInit): Promise<any> {
  return parse(
    await fetch(`/v3${path}`, {
      headers: { access_token: apiKey, 'content-type': 'application/json' },
      ...init,
    }),
  )
}

// ── tipos que as telas consomem ─────────────────────────────────────────────

export interface Account {
  id: string
  name: string
  email: string
  cpfCnpj: string
  walletId: string
  parentAccountId: string | null
  status: string
  balance: number
  apiKey: string | null
  dateCreated: string
}

export interface Clock {
  mode: 'REAL' | 'VIRTUAL_FLOWING' | 'VIRTUAL_FROZEN'
  now: string
  today: string
  epochMs: number
  driftDays: number
}

export type SummaryGroup = 'RECEIVED' | 'CONFIRMED' | 'AWAITING' | 'OVERDUE'

export interface GroupSummary {
  group: SummaryGroup
  value: number
  netValue: number
  count: number
  customers: number
  byBillingType: Array<{ billingType: string; value: number; count: number }>
}

export interface QueueHealth {
  webhookId: string
  accountId: string
  accountName: string
  name: string
  url: string
  sendType: 'SEQUENTIALLY' | 'NON_SEQUENTIALLY'
  enabled: boolean
  interrupted: boolean
  pending: number
  blocked: null | {
    reason: 'INTERRUPTED' | 'DISABLED' | 'HEAD_FAILING' | 'HEAD_IN_BACKOFF'
    event: string
    attempt: number
    lastStatusCode: number | null
    lastError: string | null
    nextAttemptAtMs: number | null
    behind: number
  }
}

export interface TestCard {
  number: string
  outcome: string
  label: string
  real: boolean
  brand: string
  error: AsaasError | null
}

export interface Payment {
  id: string
  customer: string
  billingType: string
  status: string
  value: number
  netValue: number
  dueDate: string
  paymentDate: string | null
  creditDate: string | null
  description: string | null
  externalReference: string | null
  invoiceUrl: string
}
