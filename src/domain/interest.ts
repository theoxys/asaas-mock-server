/**
 * Juros, multa e desconto. PURO.
 *
 * Regras do Asaas:
 *
 *   MULTA  — aplicada UMA VEZ, no primeiro dia de atraso. FIXED ou PERCENTAGE.
 *   JUROS  — pro-rata die sobre MÊS COMERCIAL DE 30 DIAS, a partir do 1º dia de
 *            atraso:  juros = valor × (taxa/100) / 30 × diasAtraso
 *            `interest` só tem o campo `value` — é sempre percentual ao mês.
 *            NÃO existe `interest.type` (SDKs antigos que mandam isso estão
 *            desatualizados).
 *
 *   interestValue = multa + juros
 *   value (a pagar) = originalValue + interestValue
 *
 * NÃO DOCUMENTADO pelo Asaas: se os juros incidem sobre o valor original ou
 * sobre (valor + multa). Escolhemos o valor ORIGINAL — não compomos juros sobre
 * a multa. Está registrado em progress.md como regra não confirmada.
 */
import { daysBetween, type IsoDate } from './calendar.ts'
import type { DiscountConfig, FineConfig, InterestConfig } from '../db/schema/payments.ts'
import { applyBp, bp, cents, roundCents, type Cents } from './money.ts'

/** Converte um percentual "humano" (2.5 = 2,5%) para basis points. */
const pctToBp = (pct: number) => bp(Math.round(pct * 100))

export function calcFine(fine: FineConfig | null | undefined, originalValue: Cents): Cents {
  if (!fine || fine.value <= 0) return cents(0)
  if (fine.type === 'FIXED') return roundCents(fine.value * 100)
  return applyBp(originalValue, pctToBp(fine.value))
}

/** Juros pro-rata die, mês comercial de 30 dias. */
export function calcInterest(
  interest: InterestConfig | null | undefined,
  originalValue: Cents,
  daysLate: number,
): Cents {
  if (!interest || interest.value <= 0 || daysLate <= 0) return cents(0)
  return roundCents((originalValue * (interest.value / 100) * daysLate) / 30)
}

export interface OverdueTotals {
  /** Dias de atraso. 0 = não está em atraso. */
  daysLate: number
  /** O valor antes do atraso. */
  originalValue: Cents
  /** multa + juros. */
  interestValue: Cents
  /** O valor a pagar hoje: originalValue + interestValue. */
  value: Cents
  fine: Cents
  interest: Cents
}

/**
 * Quanto se paga por uma cobrança vencida, na data `on`.
 *
 * `on` é a data em que o pagamento está sendo feito — não "hoje". É o que
 * permite simular um pagamento retroativo e conferir o cálculo.
 */
export function calcOverdueTotals(
  payment: {
    originalValueCents: Cents
    dueDate: IsoDate
    fine: FineConfig | null
    interest: InterestConfig | null
  },
  on: IsoDate,
): OverdueTotals {
  const daysLate = Math.max(0, daysBetween(on, payment.dueDate))
  const original = payment.originalValueCents

  if (daysLate === 0) {
    return {
      daysLate: 0,
      originalValue: original,
      interestValue: cents(0),
      value: original,
      fine: cents(0),
      interest: cents(0),
    }
  }

  const fine = calcFine(payment.fine, original)
  const interest = calcInterest(payment.interest, original, daysLate)
  const interestValue = cents(fine + interest)

  return {
    daysLate,
    originalValue: original,
    interestValue,
    value: cents(original + interestValue),
    fine,
    interest,
  }
}

/**
 * Desconto por pagamento antecipado.
 *
 * Vale até `dueDateLimitDays` ANTES do vencimento. Com `dueDateLimitDays = 0`
 * (o padrão), vale até o próprio dia do vencimento.
 */
export function calcDiscount(
  discount: DiscountConfig | null | undefined,
  value: Cents,
  dueDate: IsoDate,
  on: IsoDate,
): Cents {
  if (!discount || discount.value <= 0) return cents(0)

  const daysBeforeDue = daysBetween(dueDate, on)
  const limit = discount.dueDateLimitDays ?? 0

  // Pagou depois do vencimento, ou depois da janela do desconto.
  if (daysBeforeDue < limit) return cents(0)

  if (discount.type === 'FIXED') return roundCents(discount.value * 100)
  return applyBp(value, pctToBp(discount.value))
}
