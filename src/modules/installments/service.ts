/**
 * Parcelamento — a criação. (Track E)
 *
 * A diferença que define o recurso: **o parcelamento cria as N cobranças NA
 * HORA**. A assinatura não — ela gera sob demanda, 40 dias antes de cada
 * vencimento. São dois modelos opostos e é fácil confundi-los.
 *
 * Cada parcela nasce do MESMO `createPayment()` de uma cobrança avulsa. É isso
 * que garante que a parcela 7/12 tenha exatamente o mesmo formato, os mesmos
 * webhooks e o mesmo caminho de liquidação de qualquer outra cobrança — e que
 * uma correção no ciclo de vida da cobrança valha para as três origens de uma
 * vez.
 *
 * A REGRA DO RESTO: a sobra do arredondamento vai na ÚLTIMA parcela.
 *   R$ 350,00 em 12x → 11 × R$ 29,16 + 1 × R$ 29,24  (soma exata: R$ 350,00)
 */
import { asc, eq } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { invalid } from '../../core/errors.ts'
import type { DB } from '../../db/client.ts'
import { installments, payments } from '../../db/schema/index.ts'
import type {
  DiscountConfig,
  FineConfig,
  InterestConfig,
} from '../../db/schema/payments.ts'
import { isValidIsoDate, type IsoDate } from '../../domain/calendar.ts'
import type { BillingType } from '../../domain/fees.ts'
import * as ids from '../../domain/ids.ts'
import { installmentDueDates, splitTotal } from '../../domain/installments.ts'
import { brlToCents, cents, percentE4, sumCents, type Cents, type PercentE4 } from '../../domain/money.ts'
import { distributeTotalFixedValue, type SplitSpec } from '../../domain/split.ts'
import { declinesOnCharge } from '../../domain/credit-card.ts'
import {
  assertInstallmentsAllowed,
  DECLINED,
  hasCreditCard,
  persistCard,
  requireRemoteIp,
  resolveCard,
} from '../credit-cards/service.ts'
import { applyTransition } from '../payments/apply.ts'
import type { PaymentRow } from '../payments/serializer.ts'
import { createPayment } from '../payments/service.ts'

export type InstallmentRow = typeof installments.$inferSelect

/**
 * O split de um parcelamento tem DOIS campos de valor fixo, e a diferença entre
 * eles é a pegadinha do recurso:
 *
 *   fixedValue       → aplicado EM CADA parcela.   R$ 10 em 4x = R$ 40 no total.
 *   totalFixedValue  → dividido ENTRE as parcelas, com a sobra na última
 *                      (mesma regra do valor das parcelas).
 *                      R$ 100 em 3x = 33,33 | 33,33 | 33,34.
 *
 * A nomenclatura não ajuda em nada e é onde as integrações se queimam.
 */
export interface InstallmentSplitInput {
  walletId: string
  fixedValueCents: Cents | null
  percentualValueE4: PercentE4 | null
  totalFixedValueCents: Cents | null
  /** Vincula o split a UMA parcela só. Incompatível com totalFixedValue. */
  installmentNumber: number | null
  externalReference: string | null
  description: string | null
}

export interface CreateInstallmentInput {
  customerId: string
  billingType: BillingType
  installmentCount: number
  /** O total do parcelamento, já resolvido (de `totalValue` ou de `value × N`). */
  totalValueCents: Cents
  dueDate: IsoDate
  description?: string | null
  paymentExternalReference?: string | null
  discount?: DiscountConfig | null
  fine?: FineConfig | null
  interest?: InterestConfig | null
  postalService?: boolean
  daysAfterDueDateToRegistrationCancellation?: number | null
  splits: InstallmentSplitInput[]
  creditCardId?: string | null
}

export function parseInstallmentSplits(raw: unknown): InstallmentSplitInput[] {
  if (!Array.isArray(raw)) return []

  return raw.map((s: any) => {
    const hasTotalFixed = s.totalFixedValue !== undefined && s.totalFixedValue !== null
    const hasInstallmentNumber =
      s.installmentNumber !== undefined && s.installmentNumber !== null

    // A própria spec diz: "Cannot be provided along with the 'totalFixedValue'".
    if (hasTotalFixed && hasInstallmentNumber) {
      throw invalid(
        'split',
        'totalFixedValue não pode ser informado junto com installmentNumber.',
      )
    }

    return {
      walletId: String(s.walletId ?? ''),
      fixedValueCents:
        s.fixedValue !== undefined && s.fixedValue !== null
          ? brlToCents(Number(s.fixedValue))
          : null,
      // 4 casas decimais → escala 1e4. 92.3444% → 923444.
      percentualValueE4:
        s.percentualValue !== undefined && s.percentualValue !== null
          ? percentE4(Math.round(Number(s.percentualValue) * 10_000))
          : null,
      totalFixedValueCents: hasTotalFixed ? brlToCents(Number(s.totalFixedValue)) : null,
      installmentNumber: hasInstallmentNumber ? Number(s.installmentNumber) : null,
      externalReference: s.externalReference ?? null,
      description: s.description ?? null,
    }
  })
}

/**
 * Os splits que valem para UMA parcela (0-based), já com o `totalFixedValue`
 * distribuído. É aqui que a diferença entre `fixedValue` e `totalFixedValue`
 * vira aritmética.
 */
export function splitsForInstallment(
  specs: readonly InstallmentSplitInput[],
  index: number,
  count: number,
): SplitSpec[] {
  const out: SplitSpec[] = []

  for (const spec of specs) {
    // Split preso a uma parcela específica não vale para as outras.
    if (spec.installmentNumber !== null && spec.installmentNumber !== index + 1) continue

    const fixed =
      spec.totalFixedValueCents !== null
        ? distributeTotalFixedValue(spec.totalFixedValueCents, count)[index]!
        : spec.fixedValueCents

    out.push({
      walletId: spec.walletId,
      fixedValueCents: fixed ?? null,
      percentualValueE4: spec.percentualValueE4 ?? null,
      externalReference: spec.externalReference,
      description: spec.description,
    })
  }

  return out
}

/**
 * Traduz o body de **POST /v3/payments** (com `installmentCount`) para o mesmo
 * input do parcelamento.
 *
 * Existem duas portas para o mesmo recurso, e os nomes dos campos DIVERGEM entre
 * elas — é exatamente aí que a integração se queima:
 *
 *   POST /v3/installments   `value` (valor da parcela) · `splits` · `paymentExternalReference`
 *   POST /v3/payments       `installmentValue`         · `split`  · `externalReference`
 *
 * E em POST /v3/payments o `value` NÃO é o valor da parcela: quem carrega isso é
 * `installmentValue`. Usar `value` aqui multiplicaria o total por N.
 */
export function installmentInputFromPaymentBody(b: Record<string, any>): CreateInstallmentInput {
  const installmentCount = Number(b.installmentCount)
  if (!Number.isInteger(installmentCount) || installmentCount < 1) {
    throw invalid('installmentCount', 'O número de parcelas deve ser um inteiro maior que zero.')
  }

  if (!isValidIsoDate(String(b.dueDate ?? ''))) {
    throw invalid('dueDate', 'A data de vencimento informada é inválida.')
  }

  let totalValueCents: Cents
  if (b.totalValue !== undefined && b.totalValue !== null) {
    totalValueCents = brlToCents(Number(b.totalValue))
  } else if (b.installmentValue !== undefined && b.installmentValue !== null) {
    totalValueCents = cents(brlToCents(Number(b.installmentValue)) * installmentCount)
  } else {
    throw invalid(
      'value',
      'Informe totalValue (o total a ser dividido) ou installmentValue (o valor de cada parcela).',
    )
  }

  if (totalValueCents <= 0) {
    throw invalid('value', 'O valor do parcelamento deve ser maior que zero.')
  }

  return {
    customerId: String(b.customer ?? ''),
    billingType: String(b.billingType ?? 'UNDEFINED') as BillingType,
    installmentCount,
    totalValueCents,
    dueDate: String(b.dueDate),
    description: b.description ?? null,
    paymentExternalReference: b.externalReference ?? null,
    discount: b.discount ?? null,
    fine: b.fine ?? null,
    interest: b.interest ?? null,
    postalService: b.postalService ?? false,
    daysAfterDueDateToRegistrationCancellation:
      b.daysAfterDueDateToRegistrationCancellation ?? null,
    splits: parseInstallmentSplits(b.split),
  }
}

/** Traduz o body de POST /v3/installments. */
export function parseCreateInstallmentBody(b: Record<string, any>): CreateInstallmentInput {
  const installmentCount = Number(b.installmentCount)
  if (!Number.isInteger(installmentCount) || installmentCount < 1) {
    throw invalid('installmentCount', 'O número de parcelas deve ser um inteiro maior que zero.')
  }

  if (!isValidIsoDate(String(b.dueDate ?? ''))) {
    throw invalid('dueDate', 'A data de vencimento informada é inválida.')
  }

  /**
   * `value` é o valor DE CADA PARCELA; `totalValue` é o total a dividir. Informa-se
   * um OU outro. Quando vêm os dois, `totalValue` manda — é o que carrega a
   * intenção de "divida isto", e é o único que expressa R$ 350 em 12x.
   */
  let totalValueCents: Cents
  if (b.totalValue !== undefined && b.totalValue !== null) {
    totalValueCents = brlToCents(Number(b.totalValue))
  } else if (b.value !== undefined && b.value !== null) {
    totalValueCents = cents(brlToCents(Number(b.value)) * installmentCount)
  } else {
    throw invalid(
      'value',
      'Informe value (o valor de cada parcela) ou totalValue (o total a ser dividido).',
    )
  }

  if (totalValueCents <= 0) {
    throw invalid('value', 'O valor do parcelamento deve ser maior que zero.')
  }

  return {
    customerId: String(b.customer ?? ''),
    billingType: String(b.billingType ?? 'UNDEFINED') as BillingType,
    installmentCount,
    totalValueCents,
    dueDate: String(b.dueDate),
    description: b.description ?? null,
    paymentExternalReference: b.paymentExternalReference ?? null,
    discount: b.discount ?? null,
    fine: b.fine ?? null,
    interest: b.interest ?? null,
    postalService: b.postalService ?? false,
    daysAfterDueDateToRegistrationCancellation:
      b.daysAfterDueDateToRegistrationCancellation ?? null,
    splits: parseInstallmentSplits(b.splits),
  }
}

/**
 * Cria o parcelamento e TODAS as suas cobranças, numa transação só.
 *
 * `installmentCount` é passado a cada `createPayment` porque a faixa da taxa do
 * cartão depende do TOTAL de parcelas (1x: 2,99% · 2–6x: 3,49% · 7–12x: 3,99% ·
 * 13–21x: 4,29%) — e não do número da parcela.
 */
export async function createInstallment(
  ctx: AppContext,
  db: DB,
  accountId: string,
  ownWalletId: string,
  input: CreateInstallmentInput,
): Promise<{ installment: InstallmentRow; payments: PaymentRow[] }> {
  const count = input.installmentCount
  const parts = splitTotal(input.totalValueCents, count)
  const dueDates = installmentDueDates(input.dueDate, count)

  const id = ids.installmentId(ctx.rng) // UUID puro — NÃO tem prefixo. É de propósito.

  const created: PaymentRow[] = []
  for (let i = 0; i < count; i++) {
    const row = await createPayment(ctx, db, accountId, ownWalletId, {
      customerId: input.customerId,
      billingType: input.billingType,
      valueCents: parts[i]!,
      // A taxa do cartão parcelado sai do TOTAL, não da parcela. Ver
      // calcInstallmentFee — provado contra o sandbox real.
      installmentTotalCents: input.totalValueCents,
      /**
       * Sem descrição, o Asaas GERA uma: "Parcela 3 de 12." — devolvíamos null.
       * Provado contra o sandbox real.
       *
       * TODO(regra): não sabemos o que ele faz quando a descrição É informada
       * (substitui? concatena?). Aqui a informada vence. Um roteiro de paridade
       * com descrição resolve.
       */
      description: input.description ?? `Parcela ${i + 1} de ${count}.`,
      dueDate: dueDates[i]!,
      externalReference: input.paymentExternalReference ?? null,
      discount: input.discount ?? null,
      fine: input.fine ?? null,
      interest: input.interest ?? null,
      splits: splitsForInstallment(input.splits, i, count),
      postalService: input.postalService ?? false,
      daysAfterDueDateToRegistrationCancellation:
        input.daysAfterDueDateToRegistrationCancellation ?? null,
      installmentId: id,
      installmentNumber: i + 1,
      installmentCount: count,
      creditCardId: input.creditCardId ?? null,
    })
    created.push(row)
  }

  const row: InstallmentRow = {
    id,
    accountId,
    customerId: input.customerId,
    billingType: input.billingType,
    installmentCount: count,
    // O valor "da parcela" é o das N−1 primeiras; a última carrega a sobra.
    /**
     * O Asaas real reporta em `paymentValue` o valor da ÚLTIMA parcela — a que
     * carrega a sobra do arredondamento —, não o das outras onze.
     *
     * R$ 350 em 12x → 11 × R$ 29,16 + R$ 29,24, e `paymentValue` = **29,24**.
     * Provado contra o sandbox; é contraintuitivo, e não teríamos adivinhado.
     */
    installmentValueCents: parts[parts.length - 1]!,
    totalValueCents: input.totalValueCents,
    netValueCents: sumCents(created.map((p) => cents(p.netValueCents))),
    expirationDay: Number(input.dueDate.slice(8, 10)),
    description: input.description ?? null,
    paymentLinkId: null,
    checkoutSession: null,
    transactionReceiptUrl: null,
    deleted: false,
    dateCreated: ctx.clock.today(),
  }

  await db.insert(installments).values(row)

  return { installment: row, payments: created }
}

/**
 * O fluxo completo de criação de um parcelamento: valida o cartão, cria as N
 * cobranças e — havendo cartão — confirma todas.
 *
 * Vive aqui, e não no handler, porque tem DUAS portas de entrada:
 *
 *   POST /v3/installments  → devolve o objeto do parcelamento
 *   POST /v3/payments      → devolve a PRIMEIRA PARCELA (com `installment` preenchido)
 *
 * Provado contra o sandbox real: as duas criam o mesmo parcelamento; muda só o
 * que sai na resposta. Duplicar o fluxo faria as duas portas divergirem no
 * primeiro conserto que alguém esquecesse de aplicar nas duas.
 */
export async function createInstallmentFlow(
  ctx: AppContext,
  auth: AuthContext,
  body: Record<string, any>,
  input: CreateInstallmentInput,
): Promise<{ installment: InstallmentRow; payments: PaymentRow[] }> {
  // Resolve e VALIDA o cartão antes de gravar qualquer coisa: um cartão recusado
  // não pode deixar um parcelamento órfão para trás.
  const card = hasCreditCard(body)
    ? await resolveCard(ctx, ctx.db, auth.accountId, body, input.customerId)
    : null
  if (card) {
    if (input.billingType !== 'CREDIT_CARD') {
      throw invalid(
        'billingType',
        'Para pagar com cartão de crédito, billingType deve ser CREDIT_CARD.',
      )
    }
    requireRemoteIp(body)
    assertInstallmentsAllowed(card.info.brand, input.installmentCount)
    if (declinesOnCharge(card.info.outcome)) throw DECLINED
  }

  return ctx.db.transaction(async (t) => {
    const tx = t as unknown as DB
    const result = await createInstallment(ctx, tx, auth.accountId, auth.walletId, input)

    if (card) {
      const saved = await persistCard(ctx, tx, auth.accountId, input.customerId, card)
      const on = ctx.clock.today()

      for (const p of result.payments) {
        await tx.update(payments).set({ creditCardId: saved.id }).where(eq(payments.id, p.id))
        // O status SEMPRE se move por aqui — nunca UPDATE payments SET status.
        await applyTransition(ctx, p.id, { kind: 'CONFIRM', on }, tx)
      }

      // As linhas em memória são anteriores ao CONFIRM; relê-las é o que faz
      // POST /v3/payments devolver a parcela já CONFIRMED, e não PENDING.
      const fresh = await tx
        .select()
        .from(payments)
        .where(eq(payments.installmentId, result.installment.id))
        .orderBy(asc(payments.dueDate), asc(payments.createdAtMs))
      return { installment: result.installment, payments: fresh as PaymentRow[] }
    }

    return result
  })
}
