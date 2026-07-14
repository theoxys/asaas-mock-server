/**
 * Composição da aplicação. Um lugar só onde as peças impuras se juntam.
 *
 * Tanto o servidor (src/index.ts) quanto o harness de teste
 * (tests/helpers/harness.ts) passam por aqui — é o que garante que o teste
 * exercita o MESMO servidor que roda em produção, e não uma montagem paralela
 * que diverge com o tempo.
 */
import { eq } from 'drizzle-orm'
import type { Elysia } from 'elysia'
import { seedMasterAccount, type SeedResult } from './admin/seed.ts'
import { createClock, type Clock } from './core/clock.ts'
import { loadConfig, type Config } from './core/config.ts'
import type { AppContext } from './core/context.ts'
import { createEmitter } from './core/events.ts'
import { createRng } from './core/rng.ts'
import { createDb, type DB } from './db/client.ts'
import { migrate } from './db/migrate.ts'
import { clockState } from './db/schema/index.ts'
import { createApp } from './http/app.ts'
import type { HandlerMap, RegisterResult } from './http/register.ts'
import { HANDLERS } from './modules/index.ts'
import { JOBS } from './scheduler/jobs/index.ts'
import { Scheduler, type Job } from './scheduler/scheduler.ts'

export interface App {
  app: Elysia
  ctx: AppContext
  scheduler: Scheduler
  config: Config
  db: DB
  seed: SeedResult
  coverage: RegisterResult
  close(): void
}

/**
 * Parcial em dois níveis — é exatamente o que `mergeConfig` sabe mesclar.
 * Assim `{ webhook: { timeoutMs: 500 } }` compila e preserva os irmãos, em vez
 * de exigir que quem quer mudar UMA taxa redeclare a tabela inteira.
 */
export type ConfigOverrides = {
  [K in keyof Config]?: Config[K] extends object
    ? Config[K] extends readonly unknown[]
      ? Config[K]
      : Partial<Config[K]>
    : Config[K]
}

export interface BootstrapOptions {
  config?: ConfigOverrides
  handlers?: HandlerMap
  /**
   * Mesma razão do `handlers`: um track que roda em PARALELO injeta os jobs dele
   * aqui e exercita o scheduler de verdade, antes de `scheduler/jobs/index.ts`
   * ser costurado. Depois de integrado, o parâmetro vira redundante.
   */
  jobs?: Job[]
}

/**
 * O relógio NÃO é persistido, e isso é uma escolha — não um esquecimento.
 *
 * A tabela `clock_state` existe e é LIDA aqui, mas nada nunca escreve nela: um
 * comentário nesta função chegou a afirmar que "o relógio sobrevive ao restart",
 * e era falso. A leitura fica porque `CLOCK_START` e um eventual seed passam por
 * ela; a afirmação, não.
 *
 * Por que não persistir: o relógio é GLOBAL ao container e anda para frente com um
 * clique no painel. Persistir transformaria um `+32` distraído num estado
 * permanente — e o sintoma não parece um relógio, parece que "o Pix nasce
 * OVERDUE" na aplicação que está integrando do outro lado. Aconteceu, e levou uma
 * tarde para ser diagnosticado.
 *
 * Sem persistência, `docker restart` é a saída óbvia; com o botão "Voltar ao
 * presente" no painel (POST /_admin/clock/reset), nem isso é preciso. O preço é
 * que uma cobrança criada "no futuro" sobrevive a um restart que traz o relógio de
 * volta — visível, e muito menos danoso que o contrário.
 */
async function buildClock(db: DB, config: Config): Promise<Clock> {
  const [saved] = await db.select().from(clockState).where(eq(clockState.id, 1)).limit(1)

  return createClock({
    mode: config.clock.mode,
    start: config.clock.start,
    savedEpochMs: saved?.virtualEpochMs ?? null,
  })
}

/**
 * Mescla os overrides um nível abaixo da raiz.
 *
 * Um spread raso aqui é uma armadilha: `{ webhook: { timeoutMs: 500 } }` apagaria
 * `retentionDays` e `maxAttempts` junto, em silêncio. O sintoma não aparece na
 * config — aparece três camadas adiante, como `NOT NULL constraint failed:
 * webhook_deliveries.expires_at_ms`, porque `now + undefined * DAY_MS` é NaN.
 * Aconteceu. Por isso o merge é profundo nos objetos aninhados.
 */
function mergeConfig(base: Config, overrides: ConfigOverrides = {}): Config {
  const out = { ...base } as Record<string, unknown>

  for (const [key, value] of Object.entries(overrides)) {
    const current = out[key]
    const bothPlainObjects =
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current)

    out[key] = bothPlainObjects ? { ...(current as object), ...(value as object) } : value
  }

  return out as unknown as Config
}

export async function bootstrap(opts: BootstrapOptions = {}): Promise<App> {
  const config: Config = mergeConfig(loadConfig(), opts.config)

  const { db, sqlite } = createDb(config.databasePath)
  migrate(db)

  const clock = await buildClock(db, config)
  const rng = createRng(config.seed)

  const emit = createEmitter({ clock, rng, config })

  const ctx: AppContext = {
    config,
    db,
    clock,
    rng,
    emit,
    log(level, msg, data) {
      if (config.logLevel === 'silent') return
      const line = `[${clock.timestamp()}] ${level.toUpperCase()} ${msg}`
      if (data !== undefined) console.log(line, data)
      else console.log(line)
    },
  }

  const seed = await seedMasterAccount(db, config, clock, rng)

  const scheduler = new Scheduler(ctx, opts.jobs ?? JOBS)
  const { app, coverage } = createApp({
    ctx,
    handlers: opts.handlers ?? HANDLERS,
    scheduler,
  })

  return {
    app,
    ctx,
    scheduler,
    config,
    db,
    seed,
    coverage,
    close() {
      scheduler.stop()
      sqlite.close()
    },
  }
}
