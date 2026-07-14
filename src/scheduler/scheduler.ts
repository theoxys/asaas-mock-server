/**
 * O scheduler. É onde o tempo de fato acontece.
 *
 * ORDEM DOS JOBS FAZ PARTE DA SEMÂNTICA — não é incidental. Uma cobrança de
 * assinatura gerada hoje tem que poder vencer hoje; um split só pode ser
 * liberado depois que a cobrança creditou; e o dispatcher de webhook roda por
 * ÚLTIMO, para que os eventos de tudo que aconteceu no tick saiam juntos e na
 * ordem certa.
 *
 * IDEMPOTÊNCIA em três camadas, porque o custo é baixo e o estrago é alto:
 *   1. Mutex in-process — um processo Bun + SQLite é serial por construção; tick
 *      do timer e tick do admin nunca se cruzam.
 *   2. `job_runs(jobName, tickKey)` UNIQUE — jobs diários rodam uma vez por dia
 *      SIMULADO, mesmo que você dê tick dez vezes no mesmo dia.
 *   3. Compare-and-swap em toda mutação (UPDATE … WHERE status = <esperado>) —
 *      esta é a que realmente salva: uma execução duplicada altera zero linhas.
 */
import { sql } from 'drizzle-orm'
import { DAY_MS } from '../core/clock.ts'
import type { AppContext } from '../core/context.ts'

export interface TickReport {
  /** O dia simulado deste tick: '2026-02-14'. */
  tickKey: string
  now: string
  transitions: {
    resource: string
    id: string
    from: string
    to: string
    job: string
  }[]
  created: { resource: string; id: string; job: string }[]
  webhooks: {
    delivered: { deliveryId: string; event: string; statusCode: number }[]
    failed: { deliveryId: string; event: string; error: string; attempt: number }[]
  }
  ledgerEntries: number
}

export interface JobContext {
  ctx: AppContext
  report: TickReport
  /** Job diário: pule se já rodou neste dia simulado. */
  once(jobName: string): Promise<boolean>
  /**
   * O dispatcher de webhook está congelado (POST /_admin/webhooks/pause).
   * Sem isto, viajar 40 dias para testar uma assinatura esgotaria, de brinde, as
   * 15 tentativas de backoff de qualquer entrega pendente.
   */
  paused: boolean
}

export interface Job {
  name: string
  run(jc: JobContext): Promise<void>
}

function emptyReport(tickKey: string, now: string): TickReport {
  return {
    tickKey,
    now,
    transitions: [],
    created: [],
    webhooks: { delivered: [], failed: [] },
    ledgerEntries: 0,
  }
}

export class Scheduler {
  #ctx: AppContext
  #jobs: Job[]
  #running: Promise<unknown> | null = null
  #timer: ReturnType<typeof setInterval> | null = null
  /** Congela o dispatcher de webhook — ver POST /_admin/webhooks/pause. */
  paused = false

  constructor(ctx: AppContext, jobs: Job[]) {
    this.#ctx = ctx
    this.#jobs = jobs
  }

  get jobNames(): string[] {
    return this.#jobs.map((j) => j.name)
  }

  /** Um tick = um instante simulado. Serializado pelo mutex. */
  async tick(): Promise<TickReport> {
    // Mutex: se já há um tick rodando, espera. Sem isso, o timer poderia entrar
    // no meio de um advance() e duplicar transições.
    while (this.#running) await this.#running.catch(() => {})

    const run = this.#runTick()
    this.#running = run
    try {
      return await run
    } finally {
      this.#running = null
    }
  }

  async #runTick(): Promise<TickReport> {
    const ctx = this.#ctx
    const tickKey = ctx.clock.today()
    const report = emptyReport(tickKey, ctx.clock.timestamp())

    // INSERT OR IGNORE + RETURNING: se o job já rodou neste dia simulado, o
    // insert é ignorado, nada volta, e o job se pula sozinho.
    const once = async (jobName: string): Promise<boolean> => {
      const rows = await ctx.db.all<{ n: number }>(sql`
        INSERT OR IGNORE INTO job_runs (job_name, tick_key, ran_at)
        VALUES (${jobName}, ${tickKey}, ${ctx.clock.timestamp()})
        RETURNING 1 AS n
      `)
      return rows.length > 0
    }

    for (const job of this.#jobs) {
      try {
        await job.run({ ctx, report, once, paused: this.paused })
      } catch (err) {
        ctx.log('error', `Job "${job.name}" falhou`, { error: String(err) })
      }
    }

    return report
  }

  /**
   * Avança o relógio virtual dando UM TICK COMPLETO POR DIA SIMULADO.
   *
   * Isto é essencial e não é detalhe: um único tick em T+40 geraria UMA cobrança
   * de assinatura em vez de várias, e carimbaria OVERDUE com a data errada. O
   * tempo precisa ser percorrido, não pulado.
   */
  async advanceDays(days: number): Promise<TickReport[]> {
    const clock = this.#ctx.clock
    if (!('advance' in clock)) {
      throw new Error('advanceDays exige um relógio virtual (CLOCK_MODE=VIRTUAL_*)')
    }
    const reports: TickReport[] = []
    for (let i = 0; i < days; i++) {
      ;(clock as { advance(ms: number): void }).advance(DAY_MS)
      reports.push(await this.tick())
    }
    return reports
  }

  async advanceMs(ms: number): Promise<TickReport> {
    const clock = this.#ctx.clock
    if (!('advance' in clock)) {
      throw new Error('advanceMs exige um relógio virtual (CLOCK_MODE=VIRTUAL_*)')
    }
    ;(clock as { advance(ms: number): void }).advance(ms)
    return this.tick()
  }

  start(intervalMs: number): void {
    if (intervalMs <= 0) return // 0 = desligado (é o modo dos testes)
    this.#timer = setInterval(() => {
      void this.tick().catch((err) =>
        this.#ctx.log('error', 'Tick do timer falhou', { error: String(err) }),
      )
    }, intervalMs)
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer)
    this.#timer = null
  }
}
