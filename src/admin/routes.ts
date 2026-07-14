/**
 * Endpoints administrativos. NÃO existem na API do Asaas.
 *
 * São a razão de este simulador ser mais útil que o sandbox real: viagem no
 * tempo, reset determinístico, log de entregas de webhook. Ficam fora de /v3 e
 * não pedem `access_token`, para que nenhuma app cliente os alcance por engano.
 *
 * Desligue com ADMIN_ENABLED=false em qualquer ambiente compartilhado.
 */
import { desc, eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { VirtualClock } from '../core/clock.ts'
import type { AppContext } from '../core/context.ts'
import { badRequest } from '../core/errors.ts'
import { accounts, apiKeys, webhookDeliveries, webhookEvents } from '../db/schema/index.ts'
import { OPERATION_COUNT, OPERATION_IDS } from '../generated/operations.ts'
import type { Scheduler } from '../scheduler/scheduler.ts'

export function adminRoutes(ctx: AppContext, scheduler: Scheduler) {
  const virtual = (): VirtualClock => {
    if (!(ctx.clock instanceof VirtualClock)) {
      throw badRequest(
        'clock_not_virtual',
        'O relógio está em modo REAL. Suba com CLOCK_MODE=VIRTUAL_FROZEN ou ' +
          'VIRTUAL_FLOWING para poder viajar no tempo.',
      )
    }
    return ctx.clock
  }

  const app = new Elysia({ name: 'admin', prefix: '/_admin' })

  if (!ctx.config.adminEnabled) {
    return app.all('/*', () => {
      throw badRequest('admin_disabled', 'Os endpoints administrativos estão desabilitados.')
    })
  }

  return (
    app
      .get('/clock', () => ({
        mode: ctx.clock.mode,
        now: ctx.clock.timestamp(),
        today: ctx.clock.today(),
        epochMs: ctx.clock.nowMs(),
      }))

      /**
       * Avança o relógio. UM TICK COMPLETO POR DIA SIMULADO — é o que faz uma
       * assinatura gerar várias cobranças em vez de uma, e o OVERDUE cair na
       * data certa.
       *
       * Devolve um TickReport por dia, com as transições que aconteceram. É isso
       * que faz um teste ler como especificação:
       *
       *   const [r] = await advance({ days: 32 })
       *   expect(r.transitions).toContainEqual({ from: 'CONFIRMED', to: 'RECEIVED', … })
       */
      .post(
        '/clock/advance',
        async ({ body }) => {
          virtual()
          const reports = []
          if (body.days) reports.push(...(await scheduler.advanceDays(body.days)))

          const subDayMs =
            (body.hours ?? 0) * 3_600_000 +
            (body.minutes ?? 0) * 60_000 +
            (body.seconds ?? 0) * 1000
          if (subDayMs > 0) reports.push(await scheduler.advanceMs(subDayMs))

          return { now: ctx.clock.timestamp(), reports }
        },
        {
          body: t.Object({
            days: t.Optional(t.Integer({ minimum: 0, maximum: 3650 })),
            hours: t.Optional(t.Integer({ minimum: 0 })),
            minutes: t.Optional(t.Integer({ minimum: 0 })),
            seconds: t.Optional(t.Integer({ minimum: 0 })),
          }),
        },
      )

      .post(
        '/clock/set',
        async ({ body }) => {
          const clock = virtual()
          const target = new Date(body.date)
          if (Number.isNaN(target.getTime())) {
            throw badRequest('invalid_date', `Data inválida: "${body.date}".`)
          }
          clock.setTo(target.getTime())
          const report = await scheduler.tick()
          return { now: ctx.clock.timestamp(), report }
        },
        { body: t.Object({ date: t.String() }) },
      )

      /** Um tick sem mexer no relógio. Útil para drenar a fila de webhooks. */
      .post('/tick', async () => scheduler.tick())

      /**
       * Provoca um chargeback numa cobrança paga. (Track H)
       *
       * Fica AQUI, e não em /v3, porque a API do Asaas não tem operação de criar
       * chargeback — quem abre é a bandeira, não o lojista. Sem esta porta, o
       * gatilho CHARGEBACK da máquina e as 3 operações da tag "Chargeback"
       * seriam inalcançáveis, e o dev não teria como testar o fluxo. É controle
       * do simulador, igual à viagem no tempo.
       */
      .post(
        '/payments/:id/chargeback',
        async ({ params, body }) => {
          const { openChargeback } = await import('../modules/chargebacks/service.ts')
          const b = (body ?? {}) as { reason?: string }
          const row = await openChargeback(ctx, params.id, b.reason ?? 'FRAUD')
          return { id: row.id, payment: row.paymentId, status: row.status, reason: row.reason }
        },
        { body: t.Optional(t.Object({ reason: t.Optional(t.String()) })) },
      )

      .get('/webhooks/deliveries', async ({ query }) => {
        const rows = await ctx.db
          .select({
            id: webhookDeliveries.id,
            webhookId: webhookDeliveries.webhookId,
            status: webhookDeliveries.status,
            attempt: webhookDeliveries.attempt,
            nextAttemptAtMs: webhookDeliveries.nextAttemptAtMs,
            lastStatusCode: webhookDeliveries.lastStatusCode,
            lastError: webhookDeliveries.lastError,
            lastAttemptAt: webhookDeliveries.lastAttemptAt,
            event: webhookEvents.event,
            eventId: webhookEvents.id,
            payload: webhookEvents.payload,
          })
          .from(webhookDeliveries)
          .innerJoin(webhookEvents, eq(webhookDeliveries.eventId, webhookEvents.id))
          .orderBy(desc(webhookDeliveries.sequence))
          .limit(Number(query.limit ?? 50))

        return { data: rows }
      })

      /**
       * Congela o dispatcher. Necessário ao viajar no tempo por outro motivo:
       * um advance de 40 dias, sem isto, esgotaria as 15 tentativas de backoff de
       * qualquer entrega pendente e marcaria o webhook como `interrupted`.
       */
      .post('/webhooks/pause', () => {
        scheduler.paused = true
        return { paused: true }
      })
      .post('/webhooks/resume', () => {
        scheduler.paused = false
        return { paused: false }
      })

      /** Cobertura computada do manifesto — nunca mantida à mão. */
      .get('/coverage', () => {
        const implemented = ctx.coverage?.implemented ?? []
        const stubbed = ctx.coverage?.stubbed ?? []
        const variants = ctx.coverage?.variants ?? []

        // O denominador são as ROTAS: 5 operações da spec dividem rota com a
        // canônica (a variante "com cartão"), então não contam à parte.
        const routable = OPERATION_COUNT - variants.length

        return {
          specOperations: OPERATION_COUNT,
          routable,
          implemented: implemented.length,
          stubbed: stubbed.length,
          variants: variants.length,
          percent: Math.round((implemented.length / routable) * 100),
          registered: OPERATION_IDS.length,
          notImplemented: stubbed,
        }
      })

      .get('/fees', () => ctx.config.fees)

      .get('/jobs', () => ({ order: scheduler.jobNames, paused: scheduler.paused }))

      /**
       * Todas as contas do simulador, com SALDO e CHAVE DE API.
       *
       * Deliberadamente NÃO existe na API do Asaas, e não poderia existir: lá, uma
       * conta não enxerga a chave da outra, e a chave de uma subconta só aparece
       * uma vez, na criação. Aqui isso é justamente o ponto — é como o painel
       * mostra o dinheiro andando entre as contas num split, e como você entra
       * numa subconta sem ter guardado a chave dela.
       *
       * É introspecção de simulador. Vive atrás de `ADMIN_ENABLED`, fora de /v3, e
       * é a razão de esse flag existir.
       */
      .get('/accounts', async () => {
        const rows = await ctx.db
          .select()
          .from(accounts)
          .orderBy(accounts.parentAccountId, accounts.dateCreated)

        const keys = await ctx.db.select().from(apiKeys).where(eq(apiKeys.active, true))
        const keyOf = new Map(keys.map((k) => [k.accountId, k.key]))

        return {
          accounts: rows.map((a) => ({
            id: a.id,
            name: a.name,
            email: a.email,
            cpfCnpj: a.cpfCnpj,
            walletId: a.walletId,
            parentAccountId: a.parentAccountId,
            status: a.status,
            // Em reais, como toda fronteira de saída deste projeto.
            balance: a.balanceCents / 100,
            apiKey: keyOf.get(a.id) ?? null,
            dateCreated: a.dateCreated,
          })),
        }
      })
  )
}
