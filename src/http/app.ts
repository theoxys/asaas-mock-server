import { Elysia } from 'elysia'
import { panelRoutes } from '../admin/panel.ts'
import { adminRoutes } from '../admin/routes.ts'
import type { AppContext } from '../core/context.ts'
import { AsaasError, unauthorized } from '../core/errors.ts'
import type { Scheduler } from '../scheduler/scheduler.ts'
import { authenticate } from './auth.ts'
import { registerOperations, type HandlerMap, type RegisterResult } from './register.ts'

export interface AppDeps {
  ctx: AppContext
  handlers: HandlerMap
  scheduler: Scheduler
}

/** Todo erro sai no formato do Asaas: { errors: [{ code, description }] } */
function errorHandler(ctx: AppContext) {
  return ({ error, code, set }: any) => {
    if (error instanceof AsaasError) {
      set.status = error.status
      return error.toResponseBody()
    }

    // Falha do TypeBox → 400 no padrão `invalid_<campo>` do Asaas,
    // não o 422 padrão do Elysia.
    if (code === 'VALIDATION') {
      set.status = 400
      const errors = (error.all ?? [])
        .filter((e: any) => e?.path)
        .map((e: any) => ({
          code: `invalid_${String(e.path).replace(/^\//, '').replace(/\//g, '.') || 'body'}`,
          description: e.message ?? 'Valor inválido.',
        }))
      return {
        errors: errors.length
          ? errors
          : [{ code: 'invalid_body', description: 'Requisição inválida.' }],
      }
    }

    if (code === 'NOT_FOUND') {
      set.status = 404
      return {
        errors: [
          {
            code: 'not_found',
            description: 'O endpoint solicitado não existe na API do Asaas.',
          },
        ],
      }
    }

    ctx.log('error', 'Erro não tratado', { error: String(error), stack: error?.stack })
    set.status = 500
    return { errors: [{ code: 'internal_error', description: 'Erro interno do simulador.' }] }
  }
}

export function createApp(deps: AppDeps): { app: Elysia; coverage: RegisterResult } {
  const { ctx } = deps

  /**
   * As rotas da API vivem num plugin próprio para que o `derive` de autenticação
   * se aplique só a elas — os endpoints /_admin e /health não pedem access_token.
   * Os paths do manifesto já incluem o prefixo /v3, então NÃO usamos .group().
   */
  const api = new Elysia({ name: 'asaas-v3' })
    .onError(errorHandler(ctx))
    .derive(async ({ headers }) => {
      const token = headers['access_token']
      if (!token) throw unauthorized()
      return { auth: await authenticate(ctx.db, token) }
    })

  const coverage = registerOperations(api as unknown as Elysia, ctx, deps.handlers)
  ctx.coverage = coverage

  const app = new Elysia()
    .onError(errorHandler(ctx))
    .get('/health', () => ({
      status: 'ok',
      clock: ctx.clock.timestamp(),
      clockMode: ctx.clock.mode,
    }))
    .use(panelRoutes(ctx))
    .use(adminRoutes(ctx, deps.scheduler))
    .use(api)

  return { app: app as unknown as Elysia, coverage }
}
