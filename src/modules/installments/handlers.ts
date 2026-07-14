/**
 * Parcelamento — as 9 operações. (Track E)
 *
 * O que este módulo NÃO faz, e é deliberado:
 *
 *   - não muda o status de cobrança na mão. Remover, cancelar e estornar um
 *     parcelamento é aplicar o gatilho correspondente em CADA parcela, via
 *     `applyTransition()`. É o que garante que o webhook e o lançamento no ledger
 *     saiam iguais aos de uma cobrança avulsa — sem que ninguém precise lembrar.
 *   - não recalcula taxa nem netValue por conta própria: quem cria a parcela é o
 *     `createPayment()` de payments/service.ts, o mesmo de uma cobrança avulsa.
 */
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { badRequest, invalid, notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import { installments, paymentRefunds, payments, paymentSplits } from '../../db/schema/index.ts'
import * as ids from '../../domain/ids.ts'
import { brlToCents, cents, centsToBrl, sumCents } from '../../domain/money.ts'
import { computeSplits, validateSplits } from '../../domain/split.ts'
import type { HandlerMap } from '../../http/register.ts'
import { bookletOrder, paymentBookResponse } from '../booklet.ts'
import { applyTransition } from '../payments/apply.ts'
import { serializePayment, type PaymentRow } from '../payments/serializer.ts'
import { serializeInstallment } from './serializer.ts'
import {
  createInstallmentFlow,
  parseCreateInstallmentBody,
  parseInstallmentSplits,
  splitsForInstallment,
  type InstallmentRow,
} from './service.ts'

/** Isolamento por conta: parcelamento de outra conta NÃO EXISTE (404, não 403). */
async function findOwned(
  ctx: AppContext,
  auth: AuthContext,
  id: string,
): Promise<InstallmentRow> {
  const [row] = await ctx.db
    .select()
    .from(installments)
    .where(and(eq(installments.id, id), eq(installments.accountId, auth.accountId)))
    .limit(1)
  if (!row) throw notFound('Parcelamento')
  return row
}

/** As parcelas, na ordem em que o cliente as recebe: 1, 2, 3… */
async function paymentsOf(ctx: AppContext, installmentId: string): Promise<PaymentRow[]> {
  const rows = await ctx.db
    .select()
    .from(payments)
    .where(eq(payments.installmentId, installmentId))
    .orderBy(asc(payments.dueDate), asc(payments.createdAtMs))
  return rows as PaymentRow[]
}

/** Aguardando pagamento: são as únicas que podem ser removidas ou canceladas. */
const OPEN = ['PENDING', 'OVERDUE']
/** Já pagas: são as únicas que podem ser estornadas. */
const PAID = ['CONFIRMED', 'RECEIVED']

export const installmentHandlers: HandlerMap = {
  /**
   * Atende TAMBÉM `create-installment-with-credit-card` — as duas dividem
   * POST /v3/installments na spec do Asaas, e é o body que decide.
   *
   * As N cobranças nascem AQUI, todas de uma vez. É a diferença que define o
   * recurso: a assinatura não cria nada na criação.
   *
   * Com cartão, as N parcelas nascem CONFIRMED: a emissora autoriza o total de
   * uma vez e o cliente é quem paga em N vezes. Ignorar o cartão e deixar as
   * parcelas PENDING seria uma falha silenciosa — a cobrança nunca aconteceria e
   * ninguém veria erro nenhum.
   *
   * TODO(regra): o cronograma de crédito de um parcelamento no cartão não está
   * documentado. Aqui cada parcela credita pela regra normal do cartão (D+32 a
   * partir da confirmação). A suíte de paridade é quem decide isto — ver
   * progress.md.
   */
  'create-installment': async ({ ctx, auth, body }) => {
    const b = body as Record<string, any>
    const { installment } = await createInstallmentFlow(ctx, auth, b, parseCreateInstallmentBody(b))
    return serializeInstallment(ctx.db, installment)
  },

  'list-installments': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const where = and(
      eq(installments.accountId, auth.accountId),
      eq(installments.deleted, false),
    )

    const [total] = await ctx.db.select({ n: count() }).from(installments).where(where)
    const rows = await ctx.db
      .select()
      .from(installments)
      .where(where)
      .orderBy(desc(installments.dateCreated))
      .limit(limit)
      .offset(offset)

    const data = await Promise.all(rows.map((r) => serializeInstallment(ctx.db, r)))
    return listEnvelope(data, total?.n ?? 0, limit, offset)
  },

  'retrieve-a-single-installment': async ({ ctx, auth, params }) =>
    serializeInstallment(ctx.db, await findOwned(ctx, auth, params.id!)),

  /**
   * Remove o parcelamento. As parcelas ainda ABERTAS são removidas junto; as já
   * pagas ficam (não se apaga dinheiro que entrou).
   */
  'remove-installment': async ({ ctx, auth, params }) => {
    const inst = await findOwned(ctx, auth, params.id!)

    for (const p of await paymentsOf(ctx, inst.id)) {
      if (!OPEN.includes(p.status) || p.deleted) continue
      await applyTransition(ctx, p.id, { kind: 'DELETE' })
    }

    await ctx.db
      .update(installments)
      .set({ deleted: true })
      .where(and(eq(installments.id, inst.id), eq(installments.deleted, false)))

    return { deleted: true, id: inst.id }
  },

  /**
   * Cancela as COBRANÇAS do parcelamento, mas mantém o parcelamento. É diferente
   * de `remove-installment`, e a diferença é sutil: aqui o registro do
   * parcelamento continua consultável (com as parcelas pagas intactas).
   */
  'cancel-charges-of-an-installment': async ({ ctx, auth, params }) => {
    const inst = await findOwned(ctx, auth, params.id!)

    const deletedPayments: Record<string, unknown>[] = []
    for (const p of await paymentsOf(ctx, inst.id)) {
      if (!OPEN.includes(p.status) || p.deleted) continue
      await applyTransition(ctx, p.id, { kind: 'DELETE' })
      deletedPayments.push({
        id: p.id,
        installmentNumber: p.installmentNumber,
        deleted: true,
      })
    }

    return { deleted: true, id: inst.id, deletedPayments }
  },

  'list-payments-of-a-installment': async ({ ctx, auth, params, query }) => {
    const inst = await findOwned(ctx, auth, params.id!)
    const { limit, offset } = paginationParams(query)

    const filters = [eq(payments.installmentId, inst.id), eq(payments.deleted, false)]
    if (query.status) filters.push(eq(payments.status, String(query.status)))
    const where = and(...filters)

    const [total] = await ctx.db.select({ n: count() }).from(payments).where(where)
    const rows = await ctx.db
      .select()
      .from(payments)
      .where(where)
      .orderBy(asc(payments.dueDate), asc(payments.createdAtMs))
      .limit(limit)
      .offset(offset)

    const data = await Promise.all(rows.map((r) => serializePayment(ctx.db, r as PaymentRow)))
    return listEnvelope(data, total?.n ?? 0, limit, offset)
  },

  /** O carnê. Devolve um PDF de verdade — ver src/modules/booklet.ts. */
  'generate-installment-booklet': async ({ ctx, auth, params, query }) => {
    const inst = await findOwned(ctx, auth, params.id!)
    const { field, desc: descending } = bookletOrder(query)

    const rows = (await paymentsOf(ctx, inst.id)).filter((p) => !p.deleted)
    rows.sort((a, b) => {
      const cmp =
        field === 'value'
          ? a.valueCents - b.valueCents
          : a.dueDate.localeCompare(b.dueDate)
      return descending ? -cmp : cmp
    })

    return paymentBookResponse(
      `Carne — parcelamento ${inst.id}`,
      rows.map(
        (p) =>
          `Parcela ${p.installmentNumber}/${inst.installmentCount}  ` +
          `Venc. ${p.dueDate}  R$ ${centsToBrl(cents(p.valueCents)).toFixed(2)}  ` +
          `[${p.status}]  ${p.id}`,
      ),
    )
  },

  /**
   * Reescreve o split do parcelamento. Só as parcelas AINDA NÃO PAGAS mudam —
   * mexer no split de uma parcela já paga reescreveria dinheiro que já foi
   * repartido.
   *
   * Aqui vive a regra que ninguém acerta de primeira:
   *   `fixedValue`      → aplicado EM CADA parcela
   *   `totalFixedValue` → dividido ENTRE as parcelas, sobra na última
   */
  'update-installment-splits': async ({ ctx, auth, params, body }) => {
    const inst = await findOwned(ctx, auth, params.id!)
    const specs = parseInstallmentSplits((body as Record<string, any>)?.splits)

    const all = await paymentsOf(ctx, inst.id)
    const open = all.filter((p) => OPEN.includes(p.status) && !p.deleted)

    if (!open.length) {
      throw badRequest(
        'invalid_action',
        'Não há parcelas aguardando pagamento para alterar o split.',
      )
    }

    // A validação é a mesma da criação — inclusive a de não splitar para si mesmo.
    const errors = validateSplits(
      specs.map((s) => ({
        walletId: s.walletId,
        fixedValueCents: s.fixedValueCents ?? s.totalFixedValueCents,
        percentualValueE4: s.percentualValueE4,
      })),
      auth.walletId,
    )
    if (errors.length) throw invalid('split', errors[0]!.description)

    const out: Record<string, unknown>[] = []

    await ctx.db.transaction(async (tx) => {
      const openIds = open.map((p) => p.id)
      await tx.delete(paymentSplits).where(inArray(paymentSplits.paymentId, openIds))

      const timestamp = ctx.clock.timestamp()

      for (const p of open) {
        const number = Number(p.installmentNumber ?? 0)
        const forThis = splitsForInstallment(specs, number - 1, inst.installmentCount)
        if (!forThis.length) continue

        const computed = computeSplits(cents(p.netValueCents), forThis)

        for (const c of computed.splits) {
          const { accounts } = await import('../../db/schema/index.ts')
          const [dest] = await tx
            .select({ id: accounts.id })
            .from(accounts)
            .where(eq(accounts.walletId, c.spec.walletId))
            .limit(1)

          const id = ids.splitId(ctx.rng)

          await tx.insert(paymentSplits).values({
            id,
            paymentId: p.id,
            walletId: c.spec.walletId,
            recipientAccountId: dest?.id ?? null,
            fixedValueCents: c.spec.fixedValueCents ?? null,
            percentualValueE4: c.spec.percentualValueE4 ?? null,
            totalFixedValueCents: null,
            totalValueCents: c.totalValueCents,
            status: computed.divergent ? 'BLOCKED_BY_VALUE_DIVERGENCE' : 'PENDING',
            cancellationReason: null,
            refusalReason: null,
            blockedUntil: null,
            creditDate: null,
            externalReference: c.spec.externalReference ?? null,
            description: c.spec.description ?? null,
            dateCreated: timestamp,
          })

          out.push({
            id,
            walletId: c.spec.walletId,
            fixedValue:
              c.spec.fixedValueCents === null || c.spec.fixedValueCents === undefined
                ? null
                : centsToBrl(cents(c.spec.fixedValueCents)),
            percentualValue:
              c.spec.percentualValueE4 === null || c.spec.percentualValueE4 === undefined
                ? null
                : c.spec.percentualValueE4 / 10_000,
            totalValue: centsToBrl(c.totalValueCents),
            cancellationReason: null,
            status: computed.divergent ? 'BLOCKED_BY_VALUE_DIVERGENCE' : 'PENDING',
            externalReference: c.spec.externalReference ?? null,
            description: c.spec.description ?? null,
            installmentNumber: number,
          })
        }
      }
    })

    return { splits: out }
  },

  /**
   * Estorna o parcelamento: cada parcela JÁ PAGA é estornada integralmente, uma a
   * uma, pelo mesmo caminho de `refund-payment`.
   *
   * TODO(regra): a spec aceita um `value` ("Total amount to be refunded"), mas não
   * define como esse total se reparte entre as parcelas — pela ordem? pro-rata?
   * só a última? Inventar uma regra aqui produziria um estorno com cara de certo e
   * valores errados, que é exatamente o que este projeto não pode fazer. Por
   * enquanto só o estorno TOTAL é suportado, e um `value` divergente é recusado
   * explicitamente em vez de ser silenciosamente reinterpretado.
   */
  'refund-installment': async ({ ctx, auth, params, body }) => {
    const inst = await findOwned(ctx, auth, params.id!)
    const b = (body ?? {}) as Record<string, any>

    const paid = (await paymentsOf(ctx, inst.id)).filter((p) => PAID.includes(p.status))
    if (!paid.length) {
      throw badRequest(
        'invalid_action',
        'Não é possível estornar um parcelamento sem parcelas pagas.',
      )
    }

    const total = sumCents(paid.map((p) => cents(p.valueCents)))

    if (b.value !== undefined && b.value !== null) {
      const asked = brlToCents(Number(b.value))
      if (asked !== total) {
        throw invalid(
          'value',
          'O estorno parcial de parcelamento ainda não é suportado neste simulador. ' +
            `Informe ${centsToBrl(total)} (o total já pago) ou omita o campo.`,
        )
      }
    }

    const today = ctx.clock.today()

    for (const p of paid) {
      await applyTransition(ctx, p.id, { kind: 'REFUND', on: today, value: cents(p.valueCents) })

      await ctx.db.insert(paymentRefunds).values({
        id: ids.genericId(ctx.rng),
        paymentId: p.id,
        status: 'DONE',
        valueCents: p.valueCents,
        description: b.description ?? null,
        // As taxas NÃO são devolvidas — o Asaas retém.
        refundedFeeCents: 0,
        effectiveDate: today,
        transactionReceiptUrl: null,
        dateCreated: ctx.clock.timestamp(),
      })
    }

    return serializeInstallment(ctx.db, await findOwned(ctx, auth, inst.id))
  },
}
