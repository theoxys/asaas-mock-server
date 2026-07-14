/**
 * Assinatura — as 13 operações. (Track E)
 *
 * A REGRA CENTRAL, e ela custou caro para descobrir:
 *
 *   **criar a assinatura JÁ CRIA a primeira cobrança.**
 *
 * Lendo a documentação, tínhamos concluído o contrário — que a cobrança só
 * nasceria quando o vencimento entrasse na janela de 40 dias, e que o POST não
 * criava nada. Este arquivo chegou a AFIRMAR isso, em letras garrafais, com um
 * aviso para ninguém "consertar". Estava errado.
 *
 * A captura contra o sandbox real (`bun run capture`) provou:
 *
 *   POST /v3/subscriptions com nextDueDate = hoje+60
 *     → resposta traz nextDueDate = hoje+90  (já avançou um ciclo)
 *     → e a cobrança com vencimento hoje+60 JÁ EXISTE
 *
 * A janela de 40 dias (`subscriptionLookaheadDays`) governa as cobranças
 * SEGUINTES, geradas pelo scheduler. A primeira é do POST.
 *
 * Fica registrado como cautela: um comentário confiante e errado é pior que
 * comentário nenhum, porque impede a próxima pessoa de duvidar.
 */
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { badRequest, invalid, notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import {
  creditCards,
  customers,
  invoices,
  payments,
  subscriptionInvoiceConfigs,
  subscriptions,
  subscriptionSplits,
} from '../../db/schema/index.ts'
import type {
  DiscountConfig,
  FineConfig,
  InterestConfig,
} from '../../db/schema/payments.ts'
import type { InvoiceTaxesConfig } from '../../db/schema/subscription-invoice-config.ts'
import { isValidIsoDate, type Cycle } from '../../domain/calendar.ts'
import { CreditCardError, declinesOnCharge, inspectCard } from '../../domain/credit-card.ts'
import { calcFee, netValue, type BillingType } from '../../domain/fees.ts'
import * as ids from '../../domain/ids.ts'
import { brlToCents, cents, centsToBrl } from '../../domain/money.ts'
import { validateSplits } from '../../domain/split.ts'
import type { HandlerMap } from '../../http/register.ts'
import { bookletOrder, paymentBookResponse } from '../booklet.ts'
import { applyTransition } from '../payments/apply.ts'
import { serializePayment, type PaymentRow } from '../payments/serializer.ts'
import {
  serializeInvoiceConfig,
  serializeSubscription,
  type SubscriptionRow,
} from './serializer.ts'
import { generateOne, parseSubscriptionSplits } from './service.ts'

const CYCLES: Cycle[] = [
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'BIMONTHLY',
  'QUARTERLY',
  'SEMIANNUALLY',
  'YEARLY',
]

/** Aguardando pagamento: as únicas cobranças que um update pode alcançar. */
const OPEN = ['PENDING', 'OVERDUE']

/** Isolamento por conta: assinatura de outra conta NÃO EXISTE (404, não 403). */
async function findOwned(
  ctx: AppContext,
  auth: AuthContext,
  id: string,
): Promise<SubscriptionRow> {
  const [row] = await ctx.db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.accountId, auth.accountId)))
    .limit(1)
  if (!row) throw notFound('Assinatura')
  return row
}

async function persistSplitTemplate(
  ctx: AppContext,
  db: AppContext['db'],
  subscriptionId: string,
  raw: unknown,
  ownWalletId: string,
): Promise<void> {
  const specs = parseSubscriptionSplits(raw)
  if (!specs.length) return

  const errors = validateSplits(specs, ownWalletId)
  if (errors.length) throw invalid('split', errors[0]!.description)

  const timestamp = ctx.clock.timestamp()
  for (const s of specs) {
    await db.insert(subscriptionSplits).values({
      id: ids.splitId(ctx.rng),
      subscriptionId,
      walletId: s.walletId,
      fixedValueCents: s.fixedValueCents,
      percentualValueE4: s.percentualValueE4,
      status: 'ACTIVE',
      disabledReason: null,
      externalReference: s.externalReference,
      description: s.description,
      dateCreated: timestamp,
    })
  }
}

/** O taxes da NF: percentuais, não dinheiro — vão como vieram. */
function parseTaxes(raw: unknown): InvoiceTaxesConfig | null {
  if (!raw || typeof raw !== 'object') return null
  return raw as InvoiceTaxesConfig
}

/**
 * Resolve o cartão de um body: um `creditCardToken` já existente, ou os dados do
 * cartão (que são tokenizados aqui). Devolve `null` se o body não traz cartão.
 *
 * A validação (Luhn, bandeira, cartões de teste) é a MESMA do track H —
 * `inspectCard` de src/domain/credit-card.ts. Uma segunda implementação
 * divergiria da primeira no dia em que uma das duas fosse corrigida.
 */
async function resolveCreditCard(
  ctx: AppContext,
  auth: AuthContext,
  customerId: string,
  b: Record<string, any>,
): Promise<string | null> {
  if (b.creditCardToken) {
    const [existing] = await ctx.db
      .select()
      .from(creditCards)
      .where(
        and(
          eq(creditCards.creditCardToken, String(b.creditCardToken)),
          eq(creditCards.accountId, auth.accountId),
        ),
      )
      .limit(1)
    if (!existing) throw invalid('creditCardToken', 'O token de cartão informado não existe.')
    return existing.id
  }

  const card = b.creditCard
  if (!card?.number) return null

  let info
  try {
    info = inspectCard(card, ctx.clock.now())
  } catch (err) {
    if (err instanceof CreditCardError) throw badRequest(err.code, err.description)
    throw err
  }

  const creditCardId = ids.genericId(ctx.rng)

  await ctx.db.insert(creditCards).values({
    id: creditCardId,
    accountId: auth.accountId,
    customerId,
    creditCardToken: ids.creditCardToken(ctx.rng),
    // NUNCA guardamos o PAN — só os 4 últimos.
    last4: info.last4,
    brand: info.brand,
    holderName: String(card.holderName ?? ''),
    expiryMonth: String(card.expiryMonth ?? ''),
    expiryYear: String(card.expiryYear ?? ''),
    simulatedOutcome: declinesOnCharge(info.outcome) ? 'DECLINE' : 'APPROVE',
    holderInfo: b.creditCardHolderInfo ?? null,
    dateCreated: ctx.clock.timestamp(),
  })

  return creditCardId
}

export const subscriptionHandlers: HandlerMap = {
  /**
   * Atende TAMBÉM `create-subscription-with-credit-card` — as duas dividem
   * POST /v3/subscriptions na spec, e o body decide.
   *
   * A PRIMEIRA COBRANÇA É CRIADA AQUI, e o `nextDueDate` avança um ciclo. Ver o
   * cabeçalho do arquivo — e não "conserte" isto sem antes rodar a paridade.
   */
  'create-new-subscription': async ({ ctx, auth, body }) => {
    const b = body as Record<string, any>

    const cycle = String(b.cycle ?? '') as Cycle
    if (!CYCLES.includes(cycle)) {
      throw invalid('cycle', `Ciclo inválido. Use um de: ${CYCLES.join(', ')}.`)
    }

    if (!isValidIsoDate(String(b.nextDueDate ?? ''))) {
      throw invalid('nextDueDate', 'A data do próximo vencimento é inválida.')
    }
    if (b.endDate !== undefined && b.endDate !== null && !isValidIsoDate(String(b.endDate))) {
      throw invalid('endDate', 'A data de término é inválida.')
    }

    const valueCents = brlToCents(Number(b.value))
    if (!(valueCents > 0)) {
      throw invalid('value', 'O valor da assinatura deve ser maior que zero.')
    }

    const maxPayments =
      b.maxPayments === undefined || b.maxPayments === null ? null : Number(b.maxPayments)
    if (maxPayments !== null && (!Number.isInteger(maxPayments) || maxPayments < 1)) {
      throw invalid('maxPayments', 'maxPayments deve ser um inteiro maior que zero.')
    }

    const customerId = String(b.customer ?? '')
    const [customer] = await ctx.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.accountId, auth.accountId)))
      .limit(1)
    if (!customer) throw notFound('Cliente')

    const id = ids.subscriptionId(ctx.rng) // sub_<alfanumérico>

    // A assinatura no cartão guarda o cartão. Sem isto ela nasceria
    // `billingType: CREDIT_CARD` com `creditCardId: null` — e a cobrança gerada
    // daqui a 40 dias não teria cartão nenhum para cobrar. Falha silenciosa, e
    // só visível 40 dias depois.
    const creditCardId = await resolveCreditCard(ctx, auth, customerId, b)

    const row: SubscriptionRow = {
      id,
      accountId: auth.accountId,
      customerId,
      billingType: String(b.billingType ?? 'UNDEFINED'),
      cycle,
      status: 'ACTIVE',
      valueCents,
      nextDueDate: String(b.nextDueDate),
      endDate: b.endDate ?? null,
      maxPayments,
      paymentsGenerated: 0,
      description: b.description ?? null,
      externalReference: b.externalReference ?? null,
      paymentLinkId: null,
      checkoutSession: null,
      creditCardId,
      discount: b.discount ?? null,
      fine: b.fine ?? null,
      interest: b.interest ?? null,
      deleted: false,
      dateCreated: ctx.clock.today(),
    }

    await ctx.db.transaction(async (tx) => {
      await tx.insert(subscriptions).values(row)
      await persistSplitTemplate(ctx, tx as never, id, b.split, auth.walletId)

      await ctx.emit(tx as never, {
        accountId: auth.accountId,
        event: 'SUBSCRIPTION_CREATED',
        resourceType: 'subscription',
        resourceId: id,
        resource: await serializeSubscription(tx as never, row),
      })
    })

    /**
     * A PRIMEIRA COBRANÇA NASCE AQUI. Provado contra o sandbox real.
     *
     * Acreditávamos, lendo a documentação, que o Asaas só gerava a cobrança
     * quando o vencimento entrava na janela de 40 dias — e que criar uma
     * assinatura não criava cobrança nenhuma. Está errado:
     *
     *   POST /v3/subscriptions com nextDueDate = hoje+60
     *     → resposta traz nextDueDate = hoje+90 (já avançou um ciclo)
     *     → e a cobrança de hoje+60 já existe
     *
     * `generateOne` faz as duas coisas (cria a cobrança e avança o ciclo, com
     * CAS), e é a MESMA função que o job usa — nenhuma chance de a cobrança da
     * criação sair diferente da cobrança do 2º mês.
     */
    const updated = await generateOne(ctx, row)

    return serializeSubscription(ctx.db, updated ?? row)
  },

  'list-subscriptions': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const includeDeleted = String(query.includeDeleted ?? '') === 'true'
    const deletedOnly = String(query.deletedOnly ?? '') === 'true'

    const filters = [eq(subscriptions.accountId, auth.accountId)]
    if (deletedOnly) filters.push(eq(subscriptions.deleted, true))
    else if (!includeDeleted) filters.push(eq(subscriptions.deleted, false))

    if (query.customer) filters.push(eq(subscriptions.customerId, String(query.customer)))
    if (query.billingType) {
      filters.push(eq(subscriptions.billingType, String(query.billingType)))
    }
    if (query.status) filters.push(eq(subscriptions.status, String(query.status)))
    if (query.externalReference) {
      filters.push(eq(subscriptions.externalReference, String(query.externalReference)))
    }

    const where = and(...filters)

    const [total] = await ctx.db.select({ n: count() }).from(subscriptions).where(where)
    const rows = await ctx.db
      .select()
      .from(subscriptions)
      .where(where)
      .orderBy(desc(subscriptions.dateCreated))
      .limit(limit)
      .offset(offset)

    const data = await Promise.all(rows.map((r) => serializeSubscription(ctx.db, r)))
    return listEnvelope(data, total?.n ?? 0, limit, offset)
  },

  'retrieve-a-single-subscription': async ({ ctx, auth, params }) =>
    serializeSubscription(ctx.db, await findOwned(ctx, auth, params.id!)),

  /**
   * Atualiza a assinatura.
   *
   * `updatePendingPayments` é o campo que importa: com ele, a alteração alcança
   * TAMBÉM as cobranças já geradas que ainda não foram pagas. Sem ele, só as
   * FUTURAS mudam — as pendentes ficam com o preço antigo, e é isso que o Asaas
   * faz. É uma pegadinha clássica de quem sobe o preço do plano.
   *
   * As cobranças pendentes são atualizadas por UPDATE direto de campos — o status
   * NÃO muda, e por isso não passa (nem pode passar) pelo applyTransition, que é
   * o dono exclusivo das mudanças de status.
   *
   * TODO(regra): o `dueDate` das cobranças pendentes NÃO é reescrito quando o
   * `nextDueDate` muda. A doc não diz o que acontece, e com ciclos curtos (várias
   * pendentes na janela) qualquer escolha seria chute — o `nextDueDate` novo passa
   * a valer para as PRÓXIMAS gerações.
   */
  'update-existing-subscription': async ({ ctx, auth, params, body }) => {
    const sub = await findOwned(ctx, auth, params.id!)
    const b = (body ?? {}) as Record<string, any>

    if (sub.deleted) {
      throw badRequest('invalid_action', 'Não é possível alterar uma assinatura removida.')
    }

    const patch: Record<string, unknown> = {}

    if (b.billingType !== undefined && b.billingType !== null) {
      patch.billingType = String(b.billingType)
    }
    if (b.value !== undefined && b.value !== null) {
      const v = brlToCents(Number(b.value))
      if (!(v > 0)) throw invalid('value', 'O valor da assinatura deve ser maior que zero.')
      patch.valueCents = v
    }
    if (b.cycle !== undefined && b.cycle !== null) {
      if (!CYCLES.includes(String(b.cycle) as Cycle)) {
        throw invalid('cycle', `Ciclo inválido. Use um de: ${CYCLES.join(', ')}.`)
      }
      patch.cycle = String(b.cycle)
    }
    if (b.nextDueDate !== undefined && b.nextDueDate !== null) {
      if (!isValidIsoDate(String(b.nextDueDate))) {
        throw invalid('nextDueDate', 'A data do próximo vencimento é inválida.')
      }
      patch.nextDueDate = String(b.nextDueDate)
    }
    if (b.endDate !== undefined) {
      if (b.endDate !== null && !isValidIsoDate(String(b.endDate))) {
        throw invalid('endDate', 'A data de término é inválida.')
      }
      patch.endDate = b.endDate ?? null
    }
    if (b.status !== undefined && b.status !== null) {
      const status = String(b.status)
      if (status !== 'ACTIVE' && status !== 'INACTIVE') {
        throw invalid('status', 'O status da assinatura só pode ser ACTIVE ou INACTIVE.')
      }
      patch.status = status
    }
    if (b.description !== undefined) patch.description = b.description
    if (b.externalReference !== undefined) patch.externalReference = b.externalReference
    if (b.discount !== undefined) patch.discount = b.discount
    if (b.fine !== undefined) patch.fine = b.fine
    if (b.interest !== undefined) patch.interest = b.interest

    const updatePending = b.updatePendingPayments === true

    const after = await ctx.db.transaction(async (tx) => {
      if (Object.keys(patch).length) {
        await tx.update(subscriptions).set(patch).where(eq(subscriptions.id, sub.id))
      }

      // O split é um TEMPLATE: reescrevê-lo não toca nas cobranças já geradas.
      if (b.split !== undefined) {
        await tx
          .delete(subscriptionSplits)
          .where(eq(subscriptionSplits.subscriptionId, sub.id))
        await persistSplitTemplate(ctx, tx as never, sub.id, b.split, auth.walletId)
      }

      const [row] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, sub.id))
        .limit(1)
      const updated = row as SubscriptionRow

      if (updatePending) {
        const pending = await tx
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.subscriptionId, sub.id),
              eq(payments.deleted, false),
              inArray(payments.status, OPEN),
            ),
          )

        for (const p of pending) {
          const billingType = (patch.billingType ?? p.billingType) as BillingType
          const value = cents((patch.valueCents as number | undefined) ?? p.valueCents)
          // A taxa é recalculada: mudar o valor OU o meio de pagamento muda o
          // netValue — e o netValue é a base do split.
          const fee = calcFee(ctx.config.fees, billingType, value)

          const paymentPatch: Partial<typeof payments.$inferInsert> = {
            billingType,
            valueCents: value,
            feeCents: fee,
            netValueCents: netValue(value, fee),
          }
          if (patch.description !== undefined) {
            paymentPatch.description = patch.description as string | null
          }
          if (patch.discount !== undefined) {
            paymentPatch.discount = patch.discount as DiscountConfig | null
          }
          if (patch.fine !== undefined) paymentPatch.fine = patch.fine as FineConfig | null
          if (patch.interest !== undefined) {
            paymentPatch.interest = patch.interest as InterestConfig | null
          }

          await tx.update(payments).set(paymentPatch).where(eq(payments.id, p.id))

          const [fresh] = await tx.select().from(payments).where(eq(payments.id, p.id)).limit(1)

          await ctx.emit(tx as never, {
            accountId: auth.accountId,
            event: 'PAYMENT_UPDATED',
            resourceType: 'payment',
            resourceId: p.id,
            resource: await serializePayment(tx as never, fresh as PaymentRow),
          })
        }
      }

      await ctx.emit(tx as never, {
        accountId: auth.accountId,
        event:
          patch.status === 'INACTIVE' ? 'SUBSCRIPTION_INACTIVATED' : 'SUBSCRIPTION_UPDATED',
        resourceType: 'subscription',
        resourceId: sub.id,
        resource: await serializeSubscription(tx as never, updated),
      })

      return updated
    })

    return serializeSubscription(ctx.db, after)
  },

  /**
   * Remove a assinatura. As cobranças já geradas e ainda ABERTAS vão junto — o
   * Asaas não deixa cobrança órfã de assinatura removida esperando pagamento.
   * As já pagas ficam.
   */
  'remove-subscription': async ({ ctx, auth, params }) => {
    const sub = await findOwned(ctx, auth, params.id!)

    const open = await ctx.db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.subscriptionId, sub.id),
          eq(payments.deleted, false),
          inArray(payments.status, OPEN),
        ),
      )

    for (const p of open) {
      await applyTransition(ctx, p.id, { kind: 'DELETE' })
    }

    await ctx.db.transaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({ deleted: true })
        .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.deleted, false)))

      const [row] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, sub.id))
        .limit(1)

      await ctx.emit(tx as never, {
        accountId: auth.accountId,
        event: 'SUBSCRIPTION_DELETED',
        resourceType: 'subscription',
        resourceId: sub.id,
        resource: await serializeSubscription(tx as never, row as SubscriptionRow),
      })
    })

    return { deleted: true, id: sub.id }
  },

  'list-payments-of-a-subscription': async ({ ctx, auth, params, query }) => {
    const sub = await findOwned(ctx, auth, params.id!)
    const { limit, offset } = paginationParams(query)

    const filters = [eq(payments.subscriptionId, sub.id), eq(payments.deleted, false)]
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

  /**
   * O carnê da assinatura. PDF de verdade — ver src/modules/booklet.ts.
   *
   * `month`/`year` filtram por vencimento. Só existem as cobranças JÁ GERADAS: um
   * carnê de uma assinatura nova vem vazio, porque a primeira cobrança só nasce a
   * 40 dias do vencimento. É contraintuitivo e é o comportamento real.
   */
  'generate-subscription-booklet': async ({ ctx, auth, params, query }) => {
    const sub = await findOwned(ctx, auth, params.id!)
    const { field, desc: descending } = bookletOrder(query)

    const rows = (await ctx.db
      .select()
      .from(payments)
      .where(and(eq(payments.subscriptionId, sub.id), eq(payments.deleted, false)))) as PaymentRow[]

    const month = query.month === undefined ? null : Number(query.month)
    const year = query.year === undefined ? null : Number(query.year)

    const filtered = rows.filter((p) => {
      if (year !== null && Number(p.dueDate.slice(0, 4)) !== year) return false
      if (month !== null && Number(p.dueDate.slice(5, 7)) !== month) return false
      return true
    })

    filtered.sort((a, b) => {
      const cmp =
        field === 'value' ? a.valueCents - b.valueCents : a.dueDate.localeCompare(b.dueDate)
      return descending ? -cmp : cmp
    })

    return paymentBookResponse(
      `Carne — assinatura ${sub.id}`,
      filtered.map(
        (p) =>
          `Venc. ${p.dueDate}  R$ ${centsToBrl(cents(p.valueCents)).toFixed(2)}  ` +
          `[${p.status}]  ${p.id}`,
      ),
    )
  },

  /**
   * Troca o cartão da assinatura. Vale para as cobranças FUTURAS — as já geradas
   * mantêm o cartão com que nasceram.
   */
  'update-subscription-credit-card': async ({ ctx, auth, params, body }) => {
    const sub = await findOwned(ctx, auth, params.id!)
    const b = (body ?? {}) as Record<string, any>

    const creditCardId = await resolveCreditCard(ctx, auth, sub.customerId, b)
    if (!creditCardId) {
      throw invalid('creditCard', 'Informe os dados do cartão ou um creditCardToken.')
    }

    await ctx.db
      .update(subscriptions)
      .set({ creditCardId, billingType: 'CREDIT_CARD' })
      .where(eq(subscriptions.id, sub.id))

    return serializeSubscription(ctx.db, await findOwned(ctx, auth, sub.id))
  },

  // ── Emissão de nota fiscal: um CRUD de recurso ÚNICO por assinatura ────────

  'create-configuration-for-issuance-of-invoices': async ({ ctx, auth, params, body }) => {
    const sub = await findOwned(ctx, auth, params.id!)
    const b = (body ?? {}) as Record<string, any>

    const row = {
      subscriptionId: sub.id,
      accountId: auth.accountId,
      municipalServiceId: b.municipalServiceId ?? null,
      municipalServiceCode: b.municipalServiceCode ?? null,
      municipalServiceName: b.municipalServiceName ?? null,
      deductionsCents:
        b.deductions === undefined || b.deductions === null
          ? null
          : brlToCents(Number(b.deductions)),
      // No request o campo chama `effectiveDatePeriod`; na resposta,
      // `invoiceCreationPeriod`. É a spec do Asaas que troca o nome.
      invoiceCreationPeriod: b.effectiveDatePeriod ?? null,
      daysBeforeDueDate:
        b.daysBeforeDueDate === undefined || b.daysBeforeDueDate === null
          ? null
          : Number(b.daysBeforeDueDate),
      receivedOnly: b.receivedOnly ?? null,
      updatePayment: b.updatePayment ?? null,
      observations: b.observations ?? null,
      taxes: parseTaxes(b.taxes),
      dateCreated: ctx.clock.timestamp(),
    }

    // Recurso único: recriar sobrescreve.
    await ctx.db
      .delete(subscriptionInvoiceConfigs)
      .where(eq(subscriptionInvoiceConfigs.subscriptionId, sub.id))
    await ctx.db.insert(subscriptionInvoiceConfigs).values(row)

    return serializeInvoiceConfig(row)
  },

  'retrieve-configuration-for-issuance-of-invoices': async ({ ctx, auth, params }) => {
    const sub = await findOwned(ctx, auth, params.id!)
    const [row] = await ctx.db
      .select()
      .from(subscriptionInvoiceConfigs)
      .where(eq(subscriptionInvoiceConfigs.subscriptionId, sub.id))
      .limit(1)

    if (!row) throw notFound('Configuração de nota fiscal')
    return serializeInvoiceConfig(row)
  },

  'update-configuration-for-issuance-of-invoices': async ({ ctx, auth, params, body }) => {
    const sub = await findOwned(ctx, auth, params.id!)
    const b = (body ?? {}) as Record<string, any>

    const [current] = await ctx.db
      .select()
      .from(subscriptionInvoiceConfigs)
      .where(eq(subscriptionInvoiceConfigs.subscriptionId, sub.id))
      .limit(1)

    if (!current) throw notFound('Configuração de nota fiscal')

    const patch: Record<string, unknown> = {}
    if (b.deductions !== undefined) {
      patch.deductionsCents = b.deductions === null ? null : brlToCents(Number(b.deductions))
    }
    if (b.effectiveDatePeriod !== undefined) patch.invoiceCreationPeriod = b.effectiveDatePeriod
    if (b.daysBeforeDueDate !== undefined) {
      patch.daysBeforeDueDate =
        b.daysBeforeDueDate === null ? null : Number(b.daysBeforeDueDate)
    }
    if (b.receivedOnly !== undefined) patch.receivedOnly = b.receivedOnly
    if (b.observations !== undefined) patch.observations = b.observations
    if (b.taxes !== undefined) patch.taxes = parseTaxes(b.taxes)

    if (Object.keys(patch).length) {
      await ctx.db
        .update(subscriptionInvoiceConfigs)
        .set(patch)
        .where(eq(subscriptionInvoiceConfigs.subscriptionId, sub.id))
    }

    const [row] = await ctx.db
      .select()
      .from(subscriptionInvoiceConfigs)
      .where(eq(subscriptionInvoiceConfigs.subscriptionId, sub.id))
      .limit(1)

    return serializeInvoiceConfig(row!)
  },

  'remove-configuration-for-issuance-of-invoices': async ({ ctx, auth, params }) => {
    const sub = await findOwned(ctx, auth, params.id!)

    const [row] = await ctx.db
      .select()
      .from(subscriptionInvoiceConfigs)
      .where(eq(subscriptionInvoiceConfigs.subscriptionId, sub.id))
      .limit(1)

    if (!row) throw notFound('Configuração de nota fiscal')

    await ctx.db
      .delete(subscriptionInvoiceConfigs)
      .where(eq(subscriptionInvoiceConfigs.subscriptionId, sub.id))

    return { deleted: true, id: sub.id }
  },

  /**
   * As notas fiscais das cobranças da assinatura.
   *
   * A EMISSÃO da nota é do track G — aqui só relacionamos as notas às cobranças
   * geradas por esta assinatura. Enquanto o track G não emitir nenhuma, a lista
   * vem legitimamente vazia (e não com dados inventados).
   */
  'list-invoices-for-subscription-charges': async ({ ctx, auth, params, query }) => {
    const sub = await findOwned(ctx, auth, params.id!)
    const { limit, offset } = paginationParams(query)

    const paymentIds = (
      await ctx.db
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.subscriptionId, sub.id))
    ).map((p) => p.id)

    if (!paymentIds.length) return listEnvelope([], 0, limit, offset)

    const filters = [
      eq(invoices.accountId, auth.accountId),
      inArray(invoices.paymentId, paymentIds),
    ]
    if (query.status) filters.push(eq(invoices.status, String(query.status)))
    if (query.externalReference) {
      // A nota não tem externalReference própria; o filtro casa com a da cobrança.
      const refs = await ctx.db
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.subscriptionId, sub.id),
            eq(payments.externalReference, String(query.externalReference)),
          ),
        )
      filters.push(inArray(invoices.paymentId, refs.length ? refs.map((r) => r.id) : ['']))
    }

    const where = and(...filters)

    const [total] = await ctx.db.select({ n: count() }).from(invoices).where(where)
    const rows = await ctx.db
      .select()
      .from(invoices)
      .where(where)
      .orderBy(asc(invoices.dateCreated))
      .limit(limit)
      .offset(offset)

    const data = rows.map((inv) => ({
      object: 'invoice',
      id: inv.id,
      status: inv.status,
      customer: inv.customerId,
      payment: inv.paymentId,
      installment: inv.installmentId,
      type: 'NFS-e',
      statusDescription: null,
      serviceDescription: inv.serviceDescription,
      pdfUrl: inv.pdfUrl,
      xmlUrl: inv.xmlUrl,
      rpsSerie: inv.rpsSerie,
      rpsNumber: inv.rpsNumber,
      number: inv.number,
      validationCode: null,
      value: centsToBrl(cents(inv.valueCents)),
      deductions: inv.deductionsCents === null ? null : centsToBrl(cents(inv.deductionsCents)),
      effectiveDate: inv.effectiveDate,
      observations: inv.observations,
      taxes: inv.taxes ?? null,
    }))

    return listEnvelope(data, total?.n ?? 0, limit, offset)
  },
}
