/**
 * O harness de teste. É o arquivo que decide se este projeto é testável.
 *
 * Três coisas que ele faz e que são o ponto:
 *
 * 1. Sobe o SERVIDOR DE VERDADE (via bootstrap), não uma montagem paralela que
 *    diverge com o tempo. SQLite em memória, relógio congelado, RNG semeado.
 *
 * 2. Valida o CONTRATO em toda resposta que a suíte inteira produzir, contra o
 *    schema TypeBox gerado da spec do Asaas. Cobertura de contrato vira
 *    subproduto de escrever teste de feature — ninguém precisa lembrar de fazer.
 *
 * 3. `advance()` DRENA A FILA DE WEBHOOKS antes de cada passo de dia. Sem isso,
 *    avançar 40 dias para testar uma assinatura esgotaria, de brinde, as 15
 *    tentativas de backoff de qualquer entrega pendente e marcaria o webhook como
 *    `interrupted` — e os testes seguintes veriam zero webhooks, sem explicação.
 */
import { Value } from '@sinclair/typebox/value'
import { eq, sql } from 'drizzle-orm'
import { bootstrap, type App, type ConfigOverrides } from '../../src/bootstrap.ts'
import { VirtualClock } from '../../src/core/clock.ts'

import { accounts, financialTransactions } from '../../src/db/schema/index.ts'
import { getOperation, type OperationId } from '../../src/generated/operations.ts'
import type { HandlerMap } from '../../src/http/register.ts'
import { HANDLERS } from '../../src/modules/index.ts'
import { JOBS } from '../../src/scheduler/jobs/index.ts'
import type { Job, TickReport } from '../../src/scheduler/scheduler.ts'
import { WebhookSink } from './webhook-sink.ts'

export const TEST_API_KEY = '$aact_hmlg_test0000000000000000000000000'
/** Segunda-feira, para que "dia útil" não vire uma variável escondida. */
export const TEST_CLOCK_START = '2026-01-05T09:00:00-03:00'

export class ContractViolation extends Error {
  constructor(operationId: string, status: number, errors: string[], body: unknown) {
    super(
      `A resposta de "${operationId}" (HTTP ${status}) não bate com o schema da ` +
        `spec do Asaas:\n  ${errors.join('\n  ')}\n\nCorpo recebido:\n` +
        JSON.stringify(body, null, 2),
    )
    this.name = 'ContractViolation'
  }
}

export interface ApiResponse<T = any> {
  status: number
  body: T
}

export class ApiClient {
  constructor(
    private readonly app: App['app'],
    private readonly apiKey: string,
  ) {}

  async call<T = any>(
    operationId: OperationId,
    opts: {
      params?: Record<string, string>
      query?: Record<string, string | number | undefined>
      body?: unknown
    } = {},
  ): Promise<ApiResponse<T>> {
    const op = getOperation(operationId)
    if (!op) throw new Error(`operationId desconhecido: ${operationId}`)

    let path: string = op.specPath
    for (const [k, v] of Object.entries(opts.params ?? {})) {
      path = path.replace(`{${k}}`, encodeURIComponent(v))
    }
    const remaining = path.match(/\{([^}]+)\}/)
    if (remaining) {
      throw new Error(`Parâmetro "${remaining[1]}" não informado para ${operationId}`)
    }

    const url = new URL(`http://localhost${path}`)
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }

    const res = await this.app.handle(
      new Request(url.toString(), {
        method: op.method.toUpperCase(),
        headers: {
          access_token: this.apiKey,
          ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      }),
    )

    const text = await res.text()
    const body = text ? JSON.parse(text) : null

    this.#assertContract(operationId, res.status, body)
    return { status: res.status, body }
  }

  /**
   * Valida a resposta contra o schema gerado da spec. Roda em TODA chamada da
   * suíte, de graça.
   */
  #assertContract(operationId: OperationId, status: number, body: unknown): void {
    // Erros (4xx/5xx) não têm schema de sucesso; conferimos só o envelope.
    if (status >= 400) {
      const errs = (body as any)?.errors
      if (!Array.isArray(errs) || !errs.every((e) => e?.code && e?.description)) {
        throw new ContractViolation(
          operationId,
          status,
          ['erro fora do formato { errors: [{ code, description }] }'],
          body,
        )
      }
      return
    }

    const schema = (getOperation(operationId).responses as Record<number, any>)[status]
    if (!schema) return

    if (!Value.Check(schema, body)) {
      const errors = [...Value.Errors(schema, body)]
        .slice(0, 8)
        .map((e) => `${e.path || '/'}: ${e.message}`)
      throw new ContractViolation(operationId, status, errors, body)
    }
  }
}

export interface Harness {
  app: App
  api: ApiClient
  /** Cliente de outra conta — para testar split entre contas. */
  as(apiKey: string): ApiClient
  sink: WebhookSink
  clock: VirtualClock
  accountId: string
  walletId: string

  tick(): Promise<TickReport>
  advance(d: {
    days?: number
    hours?: number
    minutes?: number
  }): Promise<TickReport[]>

  /** balanceCents === SUM(ledger). Chame no fim de todo cenário financeiro. */
  assertLedgerBalances(): Promise<void>

  /** Cadastra um webhook apontando para o sink. Devolve o id. */
  subscribeWebhook(events: string[]): Promise<string>

  close(): void
}

/**
 * Sobe o servidor de verdade. Sem injeção de handlers nem de jobs: o teste
 * exercita o `HANDLERS` e o `JOBS` que o `bun start` usa.
 *
 * (Houve um parâmetro `extraHandlers`/`extraJobs` enquanto os tracks rodavam em
 * paralelo, para que cada agente testasse o seu antes da costura. Foi removido de
 * propósito: um teste que registra os próprios handlers passa mesmo que a costura
 * nunca tenha acontecido — ele se auto-serve, e a suíte deixa de provar que o
 * servidor real responde aquela rota.)
 */
export async function createHarness(overrides: ConfigOverrides = {}): Promise<Harness> {
  const sink = await WebhookSink.start()

  const app = await bootstrap({
    config: {
      databasePath: ':memory:',
      seed: 1, // RNG semeado → IDs determinísticos
      logLevel: 'silent',
      adminEnabled: true,
      clock: {
        mode: 'VIRTUAL_FROZEN',
        start: TEST_CLOCK_START,
        tickIntervalMs: 0, // sem timer: o teste controla o tempo
      },
      seedAccount: {
        apiKey: TEST_API_KEY,
        name: 'Conta de Teste',
        cpfCnpj: '47960950000121',
        email: 'teste@localhost',
        balanceCents: 0 as never,
      },
      webhook: {
        localhostRewrite: undefined, // fora do Docker: não reescreve
        timeoutMs: 1000, // 10s deixaria o teste de timeout lento demais
        maxAttempts: 15,
        retentionDays: 14,
        maxPerAccount: 10,
      },
      ...overrides,
    },
  })

  const clock = app.ctx.clock as VirtualClock

  const harness: Harness = {
    app,
    api: new ApiClient(app.app, TEST_API_KEY),
    as: (key) => new ApiClient(app.app, key),
    sink,
    clock,
    accountId: app.seed.accountId,
    walletId: app.seed.walletId,

    tick: () => app.scheduler.tick(),

    async advance({ days = 0, hours = 0, minutes = 0 }) {
      const reports: TickReport[] = []
      for (let i = 0; i < days; i++) {
        // Drena a fila ANTES de avançar: ver o comentário no topo do arquivo.
        await app.scheduler.tick()
        clock.advance(86_400_000)
        reports.push(await app.scheduler.tick())
      }
      const subDayMs = hours * 3_600_000 + minutes * 60_000
      if (subDayMs > 0) {
        clock.advance(subDayMs)
        reports.push(await app.scheduler.tick())
      }
      return reports
    },

    async assertLedgerBalances() {
      // Agrupado em JS de propósito: um subquery correlacionado aqui é fácil de
      // escrever errado e passar a devolver 0 em silêncio — o que faria a
      // asserção sempre passar, que é o pior defeito possível num invariante.
      const accountRows = await app.db
        .select({ id: accounts.id, balance: accounts.balanceCents })
        .from(accounts)

      const entries = await app.db
        .select({
          accountId: financialTransactions.accountId,
          value: financialTransactions.valueCents,
        })
        .from(financialTransactions)

      const sums = new Map<string, number>()
      for (const e of entries) {
        sums.set(e.accountId, (sums.get(e.accountId) ?? 0) + e.value)
      }

      for (const row of accountRows) {
        const ledger = sums.get(row.id) ?? 0
        if (row.balance !== ledger) {
          throw new Error(
            `Saldo da conta ${row.id} não bate com o extrato: ` +
              `accounts.balance_cents=${row.balance}, SUM(ledger)=${ledger}. ` +
              `Alguém mexeu em saldo sem passar por postEntries().`,
          )
        }
      }
    },

    /**
     * Cadastra um webhook apontando para o sink. Sem isto, nenhum evento é
     * entregue — o fan-out só cria entregas para webhooks inscritos.
     */
    async subscribeWebhook(events: string[]) {
      const { webhooks } = await import('../../src/db/schema/index.ts')
      const ids = await import('../../src/domain/ids.ts')
      const id = ids.webhookConfigId(app.ctx.rng)

      await app.db.insert(webhooks).values({
        id,
        accountId: app.seed.accountId,
        name: 'sink',
        url: sink.url,
        email: 'sink@localhost',
        enabled: true,
        interrupted: false,
        authToken: 'a'.repeat(32),
        apiVersion: 3,
        sendType: 'SEQUENTIALLY',
        events,
        dateCreated: app.ctx.clock.timestamp(),
      })
      return id
    },

    close() {
      sink.stop()
      app.close()
    },
  }

  return harness
}

/** Cria uma segunda conta (com API key própria) para os testes de split. */
export async function createSecondAccount(
  h: Harness,
  name = 'Conta Secundária',
): Promise<{ accountId: string; walletId: string; apiKey: string }> {
  const { accounts: accountsTable, apiKeys } = await import('../../src/db/schema/index.ts')
  const ids = await import('../../src/domain/ids.ts')
  const rng = h.app.ctx.rng

  const accountId = ids.accountId(rng)
  const walletId = ids.walletId(rng)
  const apiKey = ids.apiKey(rng)

  await h.app.db.insert(accountsTable).values({
    id: accountId,
    walletId,
    parentAccountId: h.accountId,
    name,
    email: `${name.toLowerCase().replace(/\s/g, '-')}@localhost`,
    cpfCnpj: '24971563792',
    personType: 'FISICA',
    country: 'Brasil',
    status: 'APPROVED',
    balanceCents: 0,
    dateCreated: h.app.ctx.clock.timestamp(),
  })

  await h.app.db.insert(apiKeys).values({
    id: ids.genericId(rng),
    accountId,
    key: apiKey,
    name: 'Chave',
    active: true,
    dateCreated: h.app.ctx.clock.timestamp(),
  })

  void eq // mantém o import usado pela tipagem do drizzle
  return { accountId, walletId, apiKey }
}
