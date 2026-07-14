/**
 * Serialização de cobrança no formato EXATO da resposta do Asaas.
 *
 * A fronteira onde centavos viram reais. Nada de aritmética daqui para fora.
 */
import { eq } from 'drizzle-orm'
import type { DB } from '../../db/client.ts'
import { chargebacks, creditCards, payments, paymentSplits } from '../../db/schema/index.ts'
import { centsToBrl, cents } from '../../domain/money.ts'

export type PaymentRow = typeof payments.$inferSelect
export type SplitRow = typeof paymentSplits.$inferSelect

const money = (v: number | null): number | null => (v === null ? null : centsToBrl(cents(v)))

function serializeSplit(s: SplitRow) {
  return {
    id: s.id,
    walletId: s.walletId,
    fixedValue: money(s.fixedValueCents),
    // Percentual é guardado na escala 1e4 (4 casas). 923444 → 92.3444
    percentualValue: s.percentualValueE4 === null ? null : s.percentualValueE4 / 10_000,
    totalValue: money(s.totalValueCents),
    status: s.status,
    cancellationReason: s.cancellationReason,
    refusalReason: s.refusalReason,
    externalReference: s.externalReference,
    description: s.description,
  }
}

export async function serializePayment(
  db: DB,
  p: PaymentRow,
): Promise<Record<string, unknown>> {
  const splits = await db.select().from(paymentSplits).where(eq(paymentSplits.paymentId, p.id))

  /**
   * O chargeback, quando existe. A cobrança em CHARGEBACK_REQUESTED que
   * devolvesse `chargeback: null` seria uma mentira difícil de depurar: o
   * status diz que houve disputa e o objeto diz que não.
   */
  let chargeback: Record<string, unknown> | null = null
  const [cb] = await db.select().from(chargebacks).where(eq(chargebacks.paymentId, p.id)).limit(1)
  if (cb) {
    const { serializeChargeback } = await import('../chargebacks/handlers.ts')
    chargeback = await serializeChargeback(db, cb)
  }

  let card = null
  if (p.creditCardId) {
    const [row] = await db
      .select()
      .from(creditCards)
      .where(eq(creditCards.id, p.creditCardId))
      .limit(1)
    if (row) {
      card = {
        // O Asaas devolve só os 4 ÚLTIMOS dígitos — não uma máscara com asteriscos.
        creditCardNumber: row.last4,
        creditCardBrand: row.brand,
        creditCardToken: row.creditCardToken,
      }
    }
  }

  /**
   * O CONJUNTO DE CHAVES do objeto `payment` do Asaas não é fixo — foi levantado
   * campo a campo contra o sandbox real, e tem duas regras que não se adivinha:
   *
   *   1. Os campos relacionais são OMITIDOS quando nulos, não devolvidos como
   *      `null`. Uma cobrança avulsa não tem a chave `installment` — ela não vem
   *      com valor nulo, ela simplesmente não está lá. Importa: um cliente que
   *      testa `'installment' in payment` se comporta diferente nos dois casos.
   *
   *   2. Alguns campos só existem para certos meios de pagamento:
   *        BOLETO      → ganha `canBePaidAfterDueDate`
   *        CREDIT_CARD → ganha `confirmedDate` e `creditCard`
   *      Sim: um Pix PENDING **não tem** a chave `confirmedDate`. Não faz sentido
   *      óbvio, mas é o que a API devolve, e é o que reproduzimos.
   */
  const out: Record<string, unknown> = {
    object: 'payment',
    id: p.id,
    dateCreated: p.dateCreated,
    customer: p.customerId,
    checkoutSession: p.checkoutSession,
    paymentLink: p.paymentLinkId,

    value: money(p.valueCents),
    netValue: money(p.netValueCents),
    originalValue: money(p.originalValueCents),
    interestValue: money(p.interestValueCents),

    description: p.description,
    billingType: p.billingType,
    pixTransaction: p.pixTransactionId,
    status: p.status,

    dueDate: p.dueDate,
    originalDueDate: p.originalDueDate,
    paymentDate: p.paymentDate,
    clientPaymentDate: p.clientPaymentDate,
    installmentNumber: p.installmentNumber === null ? null : Number(p.installmentNumber),

    invoiceUrl: p.invoiceUrl,
    invoiceNumber: p.invoiceNumber,
    externalReference: p.externalReference,
    deleted: p.deleted,
    anticipated: p.anticipated,
    anticipable: p.anticipable,
    creditDate: p.creditDate,
    estimatedCreditDate: p.estimatedCreditDate,
    transactionReceiptUrl: p.transactionReceiptUrl,
    nossoNumero: p.nossoNumero,
    bankSlipUrl: p.bankSlipUrl,
    lastInvoiceViewedDate: p.lastInvoiceViewedDate ?? null,
    lastBankSlipViewedDate: p.lastBankSlipViewedDate ?? null,

    /**
     * `limitDate` — e não `limitedDate`, que foi o que escrevemos de primeira.
     *
     * A spec do Asaas não declara NENHUM dos dois (o objeto `discount` da
     * resposta não tem esse campo lá), então a validação de contrato não pegaria
     * o erro. Quem pegou foi a captura contra o sandbox real. É a ilustração
     * exata de por que a paridade existe: o contrato prova a FORMA, só a API real
     * prova o CONTEÚDO.
     */
    discount: p.discount
      ? {
          value: p.discount.value,
          dueDateLimitDays: p.discount.dueDateLimitDays,
          limitDate: null,
          type: p.discount.type,
        }
      : { value: 0, dueDateLimitDays: 0, limitDate: null, type: 'FIXED' },
    fine: p.fine
      ? { value: p.fine.value, type: p.fine.type }
      : { value: 0, type: 'FIXED' },
    // `interest` não tem `type` no request, mas a resposta do Asaas devolve
    // PERCENTAGE — é sempre percentual ao mês. Confirmado no sandbox real.
    interest: p.interest
      ? { value: p.interest.value, type: 'PERCENTAGE' }
      : { value: 0, type: 'PERCENTAGE' },

    postalService: p.postalService,
    escrow: null,
    // `null`, não `[]` — mesmo quando não há estorno. Confirmado no sandbox.
    refunds: null,
  }

  // ── Regra 2: campos por meio de pagamento ──
  if (p.billingType === 'BOLETO') out.canBePaidAfterDueDate = p.canBePaidAfterDueDate
  if (p.billingType === 'CREDIT_CARD') {
    // O cartão SEMPRE tem a chave — mesmo PENDING, e aí vale `null`.
    out.confirmedDate = p.confirmedDate
    out.creditCard = card
  } else if (p.confirmedDate) {
    /**
     * E QUALQUER meio ganha a chave depois de confirmado. Nós só a emitíamos para
     * cartão, então um Pix PAGO devolvia `confirmedDate: undefined` — e o cliente
     * que lê esse campo para saber quando o pagamento foi reconhecido recebia nada
     * aqui e uma data no Asaas.
     *
     * A regra real, capturada (tools/probe-pix.ts):
     *   PIX/BOLETO PENDING   → chave AUSENTE
     *   PIX/BOLETO RECEIVED  → chave presente, com a data
     *   CREDIT_CARD          → chave sempre presente (null enquanto PENDING)
     */
    out.confirmedDate = p.confirmedDate
  }

  // ── Regra 1: relacionais só aparecem quando existem ──
  if (p.subscriptionId) out.subscription = p.subscriptionId
  if (p.installmentId) out.installment = p.installmentId
  if (p.pixQrCodeId) out.pixQrCodeId = p.pixQrCodeId
  if (splits.length) out.split = splits.map(serializeSplit)
  if (chargeback) out.chargeback = chargeback
  if (p.daysAfterDueDateToRegistrationCancellation !== null) {
    out.daysAfterDueDateToRegistrationCancellation = p.daysAfterDueDateToRegistrationCancellation
  }

  return out
}

/** A versão "lean" (/v3/lean/payments): os mesmos dados sem os objetos aninhados. */
export function serializeLeanPayment(p: PaymentRow): Record<string, unknown> {
  return {
    object: 'payment',
    id: p.id,
    dateCreated: p.dateCreated,
    customer: p.customerId,
    installment: p.installmentId,
    subscription: p.subscriptionId,
    value: money(p.valueCents),
    netValue: money(p.netValueCents),
    originalValue: money(p.originalValueCents),
    interestValue: money(p.interestValueCents),
    description: p.description,
    billingType: p.billingType,
    status: p.status,
    dueDate: p.dueDate,
    originalDueDate: p.originalDueDate,
    paymentDate: p.paymentDate,
    clientPaymentDate: p.clientPaymentDate,
    installmentNumber: p.installmentNumber === null ? null : Number(p.installmentNumber),
    invoiceUrl: p.invoiceUrl,
    invoiceNumber: p.invoiceNumber,
    externalReference: p.externalReference,
    deleted: p.deleted,
    anticipated: p.anticipated,
    anticipable: p.anticipable,
    creditDate: p.creditDate,
    estimatedCreditDate: p.estimatedCreditDate,
    transactionReceiptUrl: p.transactionReceiptUrl,
    nossoNumero: p.nossoNumero,
    bankSlipUrl: p.bankSlipUrl,
    postalService: p.postalService,
  }
}
