/**
 * Criação de cobrança. Compartilhado por: cobrança avulsa, parcelamento e
 * assinatura — os três nascem da mesma função, e é isso que garante que uma
 * parcela de assinatura tenha exatamente o mesmo formato de uma cobrança avulsa.
 */
import { and, eq } from 'drizzle-orm'
import type { AppContext } from '../../core/context.ts'
import { invalid, notFound } from '../../core/errors.ts'
import type { DB } from '../../db/client.ts'
import { customers, payments, paymentSplits } from '../../db/schema/index.ts'
import type {
  CallbackConfig,
  DiscountConfig,
  FineConfig,
  InterestConfig,
} from '../../db/schema/payments.ts'
import { addBusinessDays, isValidIsoDate, type IsoDate } from '../../domain/calendar.ts'
import { calcFee, calcInstallmentFee, netValue, type BillingType } from '../../domain/fees.ts'
import * as ids from '../../domain/ids.ts'
import { brlToCents, cents, percentE4, type Cents } from '../../domain/money.ts'
import { estimatedCreditDateFor } from '../../domain/settlement.ts'
import { computeSplits, validateSplits, type SplitSpec } from '../../domain/split.ts'
import { serializePayment, type PaymentRow } from './serializer.ts'

export interface CreatePaymentInput {
  customerId: string
  billingType: BillingType
  valueCents: Cents
  dueDate: IsoDate
  description?: string | null
  externalReference?: string | null
  discount?: DiscountConfig | null
  fine?: FineConfig | null
  interest?: InterestConfig | null
  callback?: CallbackConfig | null
  splits?: SplitSpec[]
  postalService?: boolean
  daysAfterDueDateToRegistrationCancellation?: number | null

  /** Vínculos, quando a cobrança nasce de um parcelamento/assinatura. */
  installmentId?: string | null
  installmentNumber?: number | null
  /** Total de parcelas — define a faixa de taxa do cartão. */
  installmentCount?: number
  /**
   * O TOTAL do parcelamento (soma das parcelas), quando esta cobrança é uma
   * parcela.
   *
   * Existe porque a taxa do cartão parcelado NÃO se calcula sobre a parcela:
   * o Asaas cobra `fixo + pct% × total` uma única vez e divide entre as N
   * parcelas. Sem o total aqui, cada parcela pagaria o fixo de novo e o
   * percentual sobre si mesma — e o netValue sairia errado. Provado contra o
   * sandbox real; ver `calcInstallmentFee`.
   */
  installmentTotalCents?: Cents
  subscriptionId?: string | null
  creditCardId?: string | null
}

/** Traduz o body da API para a entrada do serviço. Valida o que o Asaas valida. */
export function parseCreateBody(b: Record<string, any>): Omit<CreatePaymentInput, 'customerId'> & {
  customerId: string
} {
  /**
   * A ORDEM IMPORTA, e é a do Asaas — que valida semanticamente e PARA no
   * primeiro erro, em vez de devolver a lista inteira.
   *
   * Um `POST /v3/payments` com body vazio devolve UM erro no Asaas real:
   *   {"code":"invalid_customer","description":"Customer inválido ou não informado."}
   *
   * Enquanto o schema tinha `required`, o Elysia rejeitava antes daqui e cuspia
   * 17 erros do TypeBox em inglês ("Expected string") — que nenhum cliente do
   * Asaas jamais veria. O overlay 004 tirou o `required` justamente para que a
   * validação voltasse a este lugar. Ver spec/overlays/004-payment-required.json.
   *
   * A mensagem de `customer` está PROVADA contra o sandbox. As demais são nossas:
   * o Asaas curto-circuita antes delas, então não há como capturá-las sem um
   * roteiro dedicado por campo. Está anotado em progress.md.
   */
  if (!b.customer) {
    throw invalid('customer', 'Customer inválido ou não informado.')
  }

  const billingType = String(b.billingType ?? 'UNDEFINED') as BillingType

  if (b.billingType === undefined || b.billingType === null) {
    throw invalid('billingType', 'O tipo de cobrança é obrigatório.')
  }

  if (!isValidIsoDate(String(b.dueDate ?? ''))) {
    throw invalid('dueDate', 'A data de vencimento informada é inválida.')
  }

  /**
   * Cobrança avulsa usa `value`. Parcelamento usa installmentCount +
   * (installmentValue OU totalValue). Misturar os dois é o erro clássico, e o
   * Asaas rejeita.
   */
  const hasInstallment = b.installmentCount !== undefined && Number(b.installmentCount) > 1

  let valueCents: Cents
  if (hasInstallment) {
    if (b.totalValue !== undefined) {
      valueCents = brlToCents(Number(b.totalValue))
    } else if (b.installmentValue !== undefined) {
      valueCents = cents(brlToCents(Number(b.installmentValue)) * Number(b.installmentCount))
    } else {
      throw invalid(
        'installmentValue',
        'Informe installmentValue ou totalValue para uma cobrança parcelada.',
      )
    }
  } else {
    if (b.value === undefined) throw invalid('value', 'O valor da cobrança é obrigatório.')
    valueCents = brlToCents(Number(b.value))
  }

  if (valueCents <= 0) throw invalid('value', 'O valor da cobrança deve ser maior que zero.')

  return {
    customerId: String(b.customer ?? ''),
    billingType,
    valueCents,
    dueDate: String(b.dueDate),
    description: b.description ?? null,
    externalReference: b.externalReference ?? null,
    discount: b.discount ?? null,
    fine: b.fine ?? null,
    interest: b.interest ?? null,
    callback: b.callback ?? null,
    splits: parseSplits(b.split),
    postalService: b.postalService ?? false,
    daysAfterDueDateToRegistrationCancellation:
      b.daysAfterDueDateToRegistrationCancellation ?? null,
    installmentCount: hasInstallment ? Number(b.installmentCount) : 1,
  }
}

export function parseSplits(raw: unknown): SplitSpec[] {
  if (!Array.isArray(raw)) return []
  return raw.map((s: any) => ({
    walletId: String(s.walletId ?? ''),
    fixedValueCents: s.fixedValue !== undefined ? brlToCents(Number(s.fixedValue)) : null,
    // 4 casas decimais → escala 1e4. 92.3444% → 923444
    percentualValueE4:
      s.percentualValue !== undefined
        ? percentE4(Math.round(Number(s.percentualValue) * 10_000))
        : null,
    externalReference: s.externalReference ?? null,
    description: s.description ?? null,
  }))
}

/**
 * Cria UMA cobrança. Emite PAYMENT_CREATED.
 * Não decide sobre parcelamento — quem parcela chama isto N vezes.
 */
export async function createPayment(
  ctx: AppContext,
  db: DB,
  accountId: string,
  ownWalletId: string,
  input: CreatePaymentInput,
): Promise<PaymentRow> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, input.customerId), eq(customers.accountId, accountId)))
    .limit(1)

  if (!customer) throw notFound('Cliente')

  const installmentCount = input.installmentCount ?? 1

  // Parcela de um parcelamento: a taxa vem do TOTAL, não do valor da parcela.
  // (No cartão isso muda o número; no boleto dá no mesmo — a taxa é por boleto.)
  const fee =
    input.installmentTotalCents !== undefined && installmentCount > 1
      ? calcInstallmentFee(
          ctx.config.fees,
          input.billingType,
          input.installmentTotalCents,
          installmentCount,
        )
      : calcFee(ctx.config.fees, input.billingType, input.valueCents, installmentCount)

  const net = netValue(input.valueCents, fee)

  const splits = input.splits ?? []
  const splitErrors = validateSplits(splits, ownWalletId)
  if (splitErrors.length) {
    throw invalid('split', splitErrors[0]!.description)
  }

  const id = ids.paymentId(ctx.rng)
  const today = ctx.clock.today()

  const row: PaymentRow = {
    id,
    accountId,
    customerId: input.customerId,
    subscriptionId: input.subscriptionId ?? null,
    installmentId: input.installmentId ?? null,
    installmentNumber:
      input.installmentNumber === null || input.installmentNumber === undefined
        ? null
        : String(input.installmentNumber),
    paymentLinkId: null,
    checkoutSession: null,

    billingType: input.billingType,
    status: 'PENDING',

    valueCents: input.valueCents,
    netValueCents: net,
    originalValueCents: null,
    interestValueCents: null,
    feeCents: fee,

    description: input.description ?? null,
    externalReference: input.externalReference ?? null,

    dueDate: input.dueDate,
    originalDueDate: input.dueDate,
    paymentDate: null,
    clientPaymentDate: null,
    confirmedDate: null,
    creditDate: null,
    // null enquanto PENDING — o Asaas real não promete data de crédito para
    // dinheiro que ainda não entrou. Ver `estimatedCreditDateFor`.
    estimatedCreditDate: estimatedCreditDateFor(),

    discount: input.discount ?? null,
    fine: input.fine ?? null,
    interest: input.interest ?? null,
    callback: input.callback ?? null,

    creditCardId: input.creditCardId ?? null,
    pixQrCodeId: null,
    pixTransactionId: null,

    invoiceUrl: `https://localhost/i/${id.replace('pay_', '')}`,
    bankSlipUrl:
      input.billingType === 'BOLETO' || input.billingType === 'UNDEFINED'
        ? `https://localhost/b/pdf/${id.replace('pay_', '')}`
        : null,
    transactionReceiptUrl: null,
    invoiceNumber: ids.invoiceNumber(ctx.rng),
    nossoNumero: input.billingType === 'BOLETO' ? ids.nossoNumero(ctx.rng) : null,

    daysAfterDueDateToRegistrationCancellation:
      input.daysAfterDueDateToRegistrationCancellation ?? null,
    postalService: input.postalService ?? false,
    canBePaidAfterDueDate: true,

    anticipated: false,
    anticipable: false,
    deleted: false,

    lastInvoiceViewedDate: null,
    lastBankSlipViewedDate: null,
    dateCreated: today,
    createdAtMs: ctx.clock.nowMs(),
  }

  await db.insert(payments).values(row)

  // Os splits são calculados sobre o netValue — não sobre o bruto.
  let divergent = false
  if (splits.length) {
    const computed = computeSplits(net, splits)
    const timestamp = ctx.clock.timestamp()
    divergent = computed.divergent

    /**
     * Divergência de valor: a soma dos splits excede o netValue. O Asaas não
     * rejeita a cobrança — ele BLOQUEIA os splits e dá 2 dias úteis para o
     * integrador ajustar. Passado o prazo, o job `split-divergence-expiry`
     * cancela. `blockedUntil` é esse prazo, e sem ele o job não teria como saber
     * quando o relógio começou a correr.
     */
    const blockedUntil = divergent
      ? addBusinessDays(today, ctx.config.rules.splitDivergenceGraceBusinessDays)
      : null

    for (const c of computed.splits) {
      // Se a carteira de destino é de uma conta deste servidor, o split vai
      // mesmo mover dinheiro. Se não for, fica registrado mas não credita
      // ninguém (é uma carteira externa).
      const { accounts } = await import('../../db/schema/index.ts')
      const [dest] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.walletId, c.spec.walletId))
        .limit(1)

      await db.insert(paymentSplits).values({
        id: ids.splitId(ctx.rng),
        paymentId: id,
        walletId: c.spec.walletId,
        recipientAccountId: dest?.id ?? null,
        fixedValueCents: c.spec.fixedValueCents ?? null,
        percentualValueE4: c.spec.percentualValueE4 ?? null,
        totalFixedValueCents: null,
        totalValueCents: c.totalValueCents,
        status: divergent ? 'BLOCKED_BY_VALUE_DIVERGENCE' : 'PENDING',
        cancellationReason: null,
        refusalReason: null,
        blockedUntil,
        creditDate: null,
        externalReference: c.spec.externalReference ?? null,
        description: c.spec.description ?? null,
        dateCreated: timestamp,
      })
    }
  }

  await ctx.emit(db, {
    accountId,
    event: 'PAYMENT_CREATED',
    resourceType: 'payment',
    resourceId: id,
    resource: await serializePayment(db, row),
  })

  // O bloqueio por divergência é um fato que o integrador PRECISA ver — é o
  // relógio de 2 dias úteis começando a correr.
  if (divergent) {
    await ctx.emit(db, {
      accountId,
      event: 'PAYMENT_SPLIT_DIVERGENCE_BLOCK',
      resourceType: 'payment',
      resourceId: id,
      resource: await serializePayment(db, row),
    })
  }

  return row
}
