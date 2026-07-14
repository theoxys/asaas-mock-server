/**
 * Serialização do parcelamento. A fronteira onde centavos viram reais.
 *
 * Cuidado com os três "valores" do parcelamento, que a spec nomeia mal:
 *   value        → o TOTAL do parcelamento (R$ 350,00)
 *   paymentValue → o valor da ÚLTIMA parcela, com a sobra  (R$ 29,24)
 *   netValue     → o total LÍQUIDO, já descontadas as taxas de todas as parcelas
 */
import { desc, eq, inArray } from 'drizzle-orm'
import type { DB } from '../../db/client.ts'
import { creditCards, paymentRefunds, payments } from '../../db/schema/index.ts'
import { cents, centsToBrl } from '../../domain/money.ts'
import type { InstallmentRow } from './service.ts'

const money = (v: number | null): number | null => (v === null ? null : centsToBrl(cents(v)))

export async function serializeInstallment(
  db: DB,
  row: InstallmentRow,
): Promise<Record<string, unknown>> {
  const rows = await db
    .select({
      id: payments.id,
      creditCardId: payments.creditCardId,
      confirmedDate: payments.confirmedDate,
      transactionReceiptUrl: payments.transactionReceiptUrl,
    })
    .from(payments)
    .where(eq(payments.installmentId, row.id))

  const paymentIds = rows.map((p) => p.id)

  const refunds = paymentIds.length
    ? await db
        .select()
        .from(paymentRefunds)
        .where(inArray(paymentRefunds.paymentId, paymentIds))
        .orderBy(desc(paymentRefunds.dateCreated))
    : []

  // O cartão é o mesmo para todas as parcelas — basta o da primeira que o tiver.
  let card = null
  const withCard = rows.find((p) => p.creditCardId)
  if (withCard?.creditCardId) {
    const [c] = await db
      .select()
      .from(creditCards)
      .where(eq(creditCards.id, withCard.creditCardId))
      .limit(1)
    if (c) {
      card = {
        // Só os 4 ÚLTIMOS dígitos — não uma máscara com asteriscos.
        creditCardNumber: c.last4,
        creditCardBrand: c.brand,
        creditCardToken: c.creditCardToken,
      }
    }
  }

  /**
   * `paymentDate` e `transactionReceiptUrl` do PARCELAMENTO vêm das parcelas: no
   * cartão, a emissora autoriza tudo de uma vez e o parcelamento inteiro fica
   * "pago hoje". Devolvíamos `null` nos dois.
   *
   * Repare que a fonte é o `confirmedDate` da parcela, não o `paymentDate` dela:
   * uma parcela CONFIRMED tem `paymentDate: null` (o lojista ainda não recebeu),
   * mas o parcelamento inteiro já conta como pago pelo cliente. As duas coisas
   * têm o mesmo nome e significados diferentes — é do Asaas, não nosso.
   */
  const paid = rows.find((p) => p.confirmedDate)

  return {
    object: 'installment',
    id: row.id,
    value: money(row.totalValueCents),
    netValue: money(row.netValueCents),
    paymentValue: money(row.installmentValueCents),
    installmentCount: row.installmentCount,
    billingType: row.billingType,
    paymentDate: paid?.confirmedDate ?? null,
    description: row.description,
    expirationDay: row.expirationDay,
    dateCreated: row.dateCreated,
    customer: row.customerId,
    paymentLink: row.paymentLinkId,
    checkoutSession: row.checkoutSession,
    transactionReceiptUrl: row.transactionReceiptUrl ?? paid?.transactionReceiptUrl ?? null,
    creditCard: card,
    deleted: row.deleted,
    // `null` quando não há estorno — não `[]`. O objeto `installment` do Asaas
    // também NÃO tem a chave `chargeback` (o payment tem; este não).
    refunds: refunds.length
      ? refunds.map((r) => ({
          dateCreated: r.dateCreated,
          status: r.status,
          value: money(r.valueCents),
          endToEndIdentifier: null,
          description: r.description,
          effectiveDate: r.effectiveDate,
          transactionReceiptUrl: r.transactionReceiptUrl,
          refundedSplits: [],
          paymentId: r.paymentId,
        }))
      : null,
  }
}
