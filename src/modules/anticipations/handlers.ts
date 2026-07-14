import { and, count, eq, inArray, sum } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import { anticipations, payments } from '../../db/schema/index.ts'
import { cents, centsToBrl } from '../../domain/money.ts'
import type { HandlerMap } from '../../http/register.ts'
import { serializeAnticipation, type AnticipationRow } from './serializer.ts'
import {
  ANTICIPATION_LIMIT_CENTS,
  cancelAnticipation,
  getAutoConfig,
  requestAnticipation,
  resolveTarget,
  setAutoConfig,
} from './service.ts'

async function findOwned(
  ctx: AppContext,
  auth: AuthContext,
  id: string,
): Promise<AnticipationRow> {
  const [row] = await ctx.db
    .select()
    .from(anticipations)
    .where(and(eq(anticipations.id, id), eq(anticipations.accountId, auth.accountId)))
    .limit(1)
  if (!row) throw notFound('Antecipação')
  return row as AnticipationRow
}

/** Quanto desta conta já está antecipado e ainda não liquidou. */
async function usedLimitCents(
  ctx: AppContext,
  accountId: string,
  billingType: string,
): Promise<number> {
  const [row] = await ctx.db
    .select({ total: sum(anticipations.valueCents) })
    .from(anticipations)
    .innerJoin(payments, eq(anticipations.paymentId, payments.id))
    .where(
      and(
        eq(anticipations.accountId, accountId),
        eq(payments.billingType, billingType),
        inArray(anticipations.status, ['PENDING', 'SCHEDULED', 'CREDITED']),
      ),
    )
  return Number(row?.total ?? 0)
}

export const anticipationHandlers: HandlerMap = {
  /**
   * POST /v3/anticipations — antecipar.
   *
   * O dinheiro entra AGORA se a cobrança já está confirmada. Se ainda está
   * pendente (o pagador não pagou), a antecipação nasce SCHEDULED e o
   * `anticipation-settlement` a credita quando o pagamento for confirmado.
   */
  'request-anticipation': async ({ ctx, auth, body }) => {
    const target = await resolveTarget(ctx, auth, body, { simulate: false })
    return requestAnticipation(ctx, auth.accountId, target)
  },

  /**
   * POST /v3/anticipations/simulate — a mesma conta, sem gravar nada.
   *
   * É o endpoint que o integrador chama para mostrar a taxa na tela antes de o
   * lojista decidir. Se ele divergir do POST real, a integração mente para o
   * usuário — por isso os dois passam pela MESMA função de cotação.
   */
  'simulate-anticipation': async ({ ctx, auth, body }) => {
    const { payment, quote } = await resolveTarget(ctx, auth, body, { simulate: true })

    return {
      installment: payment.installmentId,
      payment: payment.id,
      anticipationDate: ctx.clock.today(),
      dueDate: payment.estimatedCreditDate ?? payment.dueDate,
      fee: centsToBrl(quote.feeCents),
      anticipationDays: quote.anticipationDays,
      netValue: centsToBrl(quote.netValueCents),
      totalValue: centsToBrl(quote.totalValueCents),
      value: centsToBrl(quote.valueCents),
      // TODO(regra): a doc não define quando o documento é exigido. Cartão de
      // crédito confirmado é dinheiro certo (a operadora já autorizou); boleto
      // ainda pendente depende de o pagador pagar, e é aí que o Asaas pede nota
      // fiscal ou contrato.
      isDocumentationRequired: payment.billingType !== 'CREDIT_CARD',
    }
  },

  'list-anticipations': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const filters = [eq(anticipations.accountId, auth.accountId)]
    if (query.payment) filters.push(eq(anticipations.paymentId, String(query.payment)))
    if (query.installment) {
      filters.push(eq(anticipations.installmentId, String(query.installment)))
    }
    if (query.status) filters.push(eq(anticipations.status, String(query.status)))

    const where = and(...filters)

    const [total] = await ctx.db.select({ n: count() }).from(anticipations).where(where)
    const rows = await ctx.db
      .select()
      .from(anticipations)
      .where(where)
      .limit(limit)
      .offset(offset)

    return listEnvelope(
      rows.map((r) => serializeAnticipation(r as AnticipationRow)),
      total?.n ?? 0,
      limit,
      offset,
    )
  },

  'retrieve-a-single-anticipation': async ({ ctx, auth, params }) =>
    serializeAnticipation(await findOwned(ctx, auth, params.id!)),

  'cancel-anticipation': async ({ ctx, auth, params }) => {
    await findOwned(ctx, auth, params.id!) // 404 antes de 400
    return cancelAnticipation(ctx, auth, params.id!)
  },

  /**
   * GET /v3/anticipations/limits — quanto ainda dá para antecipar.
   *
   * TODO(regra): o limite real é uma análise de crédito do Asaas, sem fórmula
   * pública. Usamos um teto fixo por tipo de recebível e descontamos o que já
   * está antecipado e ainda não liquidou. Veja progress.md.
   */
  'retrieve-anticipation-limits': async ({ ctx, auth }) => {
    const total = centsToBrl(ANTICIPATION_LIMIT_CENTS)

    const [creditCardUsed, bankSlipUsed] = await Promise.all([
      usedLimitCents(ctx, auth.accountId, 'CREDIT_CARD'),
      usedLimitCents(ctx, auth.accountId, 'BOLETO'),
    ])

    return {
      creditCard: {
        total,
        available: centsToBrl(cents(Math.max(0, ANTICIPATION_LIMIT_CENTS - creditCardUsed))),
      },
      bankSlip: {
        total,
        available: centsToBrl(cents(Math.max(0, ANTICIPATION_LIMIT_CENTS - bankSlipUsed))),
      },
    }
  },

  'retrieve-status-of-automatic-anticipation': async ({ ctx, auth }) =>
    getAutoConfig(ctx.db, auth.accountId),

  /**
   * PUT /v3/anticipations/configurations — liga/desliga a antecipação
   * automática de cartão. O flag NÃO é decorativo: com ele ligado, o
   * `anticipation-settlement` antecipa sozinho toda cobrança de cartão que for
   * confirmada. Um booleano que não faz nada seria falsa confiança.
   */
  'update-status-of-automatic-anticipation': async ({ ctx, auth, body }) => {
    const b = (body ?? {}) as Record<string, any>
    return setAutoConfig(ctx, auth.accountId, b.creditCardAutomaticEnabled === true)
  },
}
