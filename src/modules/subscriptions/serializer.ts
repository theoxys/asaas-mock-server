/**
 * Serialização da assinatura. A fronteira onde centavos viram reais.
 */
import { eq } from 'drizzle-orm'
import type { DB } from '../../db/client.ts'
import {
  creditCards,
  subscriptionInvoiceConfigs,
  subscriptions,
  subscriptionSplits,
} from '../../db/schema/index.ts'
import { cents, centsToBrl } from '../../domain/money.ts'

export type SubscriptionRow = typeof subscriptions.$inferSelect
export type SubscriptionSplitRow = typeof subscriptionSplits.$inferSelect
export type InvoiceConfigRow = typeof subscriptionInvoiceConfigs.$inferSelect

const money = (v: number | null): number | null => (v === null ? null : centsToBrl(cents(v)))

function serializeSplit(s: SubscriptionSplitRow) {
  return {
    walletId: s.walletId,
    fixedValue: money(s.fixedValueCents),
    // Percentual guardado na escala 1e4 (4 casas). 923444 → 92.3444
    percentualValue: s.percentualValueE4 === null ? null : s.percentualValueE4 / 10_000,
    externalReference: s.externalReference,
    description: s.description,
    status: s.status,
    disabledReason: s.disabledReason,
  }
}

export async function serializeSubscription(
  db: DB,
  row: SubscriptionRow,
): Promise<Record<string, unknown>> {
  const splits = await db
    .select()
    .from(subscriptionSplits)
    .where(eq(subscriptionSplits.subscriptionId, row.id))

  let card = null
  if (row.creditCardId) {
    const [c] = await db
      .select()
      .from(creditCards)
      .where(eq(creditCards.id, row.creditCardId))
      .limit(1)
    if (c) {
      card = {
        creditCardNumber: c.last4,
        creditCardBrand: c.brand,
        creditCardToken: c.creditCardToken,
      }
    }
  }

  /**
   * O objeto `subscription` do Asaas tem 18 chaves, e a escolha delas é
   * inconsistente de um jeito que só a captura revela:
   *
   *   - `fine` e `interest` vêm ZERADOS quando não configurados (`{value:0,…}`)
   *   - `discount`, no mesmo caso, simplesmente NÃO APARECE
   *   - `endDate`, `maxPayments` e `creditCard` também somem quando nulos
   *   - mas `split` e `paymentLink` vêm como `null` explícito
   *
   * Não há lógica: é o serializador deles. Reproduzimos como está.
   */
  const out: Record<string, unknown> = {
    object: 'subscription',
    id: row.id,
    dateCreated: row.dateCreated,
    customer: row.customerId,
    paymentLink: row.paymentLinkId,
    value: money(row.valueCents),
    nextDueDate: row.nextDueDate,
    cycle: row.cycle,
    description: row.description,
    billingType: row.billingType,
    deleted: row.deleted,
    status: row.status,
    externalReference: row.externalReference,
    checkoutSession: row.checkoutSession,
    sendPaymentByPostalService: false,

    fine: row.fine ? { value: row.fine.value, type: row.fine.type } : { value: 0, type: 'FIXED' },
    // `interest` não tem `type` no request; a resposta do Asaas devolve
    // PERCENTAGE — é sempre percentual AO MÊS.
    interest: row.interest
      ? { value: row.interest.value, type: 'PERCENTAGE' }
      : { value: 0, type: 'PERCENTAGE' },

    split: splits.length ? splits.map(serializeSplit) : null,
  }

  if (row.discount) {
    out.discount = {
      value: row.discount.value,
      dueDateLimitDays: row.discount.dueDateLimitDays,
      type: row.discount.type,
    }
  }
  if (row.endDate) out.endDate = row.endDate
  if (row.maxPayments !== null) out.maxPayments = row.maxPayments
  if (card) out.creditCard = card

  return out
}

/**
 * A configuração de emissão de NF.
 *
 * Repare na troca de nome: no REQUEST o campo é `effectiveDatePeriod`; na
 * RESPOSTA, `invoiceCreationPeriod`. É a spec do Asaas, não um erro nosso.
 */
export function serializeInvoiceConfig(row: InvoiceConfigRow): Record<string, unknown> {
  return {
    municipalServiceId: row.municipalServiceId,
    municipalServiceCode: row.municipalServiceCode,
    municipalServiceName: row.municipalServiceName,
    deductions: money(row.deductionsCents),
    invoiceCreationPeriod: row.invoiceCreationPeriod,
    daysBeforeDueDate: row.daysBeforeDueDate,
    receivedOnly: row.receivedOnly,
    observations: row.observations,
    taxes: row.taxes,
  }
}
