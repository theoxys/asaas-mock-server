/**
 * Antecipação de recebíveis. PURO.
 *
 * TODO(regra): **A FÓRMULA DA TAXA NÃO É DOCUMENTADA PELO ASAAS.** A doc publica
 * as taxas comerciais ("a partir de 1,99% a.m.") mas não diz como o valor da taxa
 * é derivado delas. Escolhemos a fórmula abaixo — a mesma que o Asaas usa para
 * juros de mora, e a única defensável sem acesso ao motor real:
 *
 *     taxa = valor × (taxaMensalBp / 10000) / 30 × diasAntecipados
 *
 * Ou seja: pro-rata die sobre a taxa AO MÊS, com mês comercial de 30 dias. Sem
 * capitalização (juro simples) e sem taxa mínima.
 *
 * Consequência que o integrador precisa saber: antecipar um recebível de cartão
 * de 32 dias custa ≈ a taxa mensal cheia; antecipar de 5 dias custa 1/6 dela.
 *
 * Está registrado em progress.md, na tabela "Regras que a documentação não
 * define", e os números vivem em `config.fees.anticipation` (variáveis de
 * ambiente `FEE_ANTICIPATION_*`) justamente para que a correção, quando
 * descobrirmos a fórmula real, seja de configuração — não de código.
 */
import type { FeeTable } from '../core/config.ts'
import { daysBetween, type IsoDate } from './calendar.ts'
import type { BillingType } from './fees.ts'
import { cents, roundCents, type BasisPoints, type Cents } from './money.ts'

/** Dias no "mês comercial" usado no pro-rata. */
export const COMMERCIAL_MONTH_DAYS = 30

/** Só cartão de crédito e boleto têm recebível a antecipar. */
export function isAnticipableBillingType(billingType: BillingType): boolean {
  return billingType === 'CREDIT_CARD' || billingType === 'BOLETO'
}

/**
 * A taxa AO MÊS aplicável. Cartão parcelado tem taxa menor que cartão à vista
 * (o risco é diluído no tempo) — é o que a tabela pública do Asaas mostra.
 */
export function anticipationRateBp(
  fees: FeeTable,
  billingType: BillingType,
  installmentCount: number,
): BasisPoints {
  if (billingType === 'CREDIT_CARD') {
    return installmentCount > 1
      ? fees.anticipation.creditCardInstallment
      : fees.anticipation.creditCardDetached
  }
  return fees.anticipation.bankSlip
}

export interface AnticipationQuoteInput {
  fees: FeeTable
  billingType: BillingType
  installmentCount: number
  /** Valor BRUTO da cobrança. */
  totalValueCents: Cents
  /** A taxa que o Asaas já cobra pela cobrança em si (R$ 1,99 do boleto, etc.). */
  paymentFeeCents: Cents
  /** Quando o recebível cairia sem a antecipação. */
  expectedCreditDate: IsoDate
  today: IsoDate
}

export interface AnticipationQuote {
  /** Dias que estão sendo antecipados. Nunca negativo. */
  anticipationDays: number
  /** Valor bruto da cobrança. */
  totalValueCents: Cents
  /** Base da antecipação: o líquido da cobrança (bruto − taxa da cobrança). */
  valueCents: Cents
  /** A taxa de antecipação. */
  feeCents: Cents
  /** O que de fato cai na conta hoje. */
  netValueCents: Cents
  monthlyRateBp: BasisPoints
}

/**
 * A conta inteira, num lugar só.
 *
 * Note que a base NÃO é o valor bruto: é o líquido da cobrança. Antecipar não
 * devolve a taxa da cobrança — ela continua sendo cobrada quando o recebível
 * liquidar. É o que os exemplos da própria spec mostram
 * (totalValue 80 → value 76,01 → fee 2,33 → netValue 73,68).
 */
export function quoteAnticipation(input: AnticipationQuoteInput): AnticipationQuote {
  const days = Math.max(0, daysBetween(input.expectedCreditDate, input.today))
  const monthlyRateBp = anticipationRateBp(
    input.fees,
    input.billingType,
    input.installmentCount,
  )

  const valueCents = cents(input.totalValueCents - input.paymentFeeCents)

  const feeCents = roundCents(
    (valueCents * monthlyRateBp) / 10_000 / COMMERCIAL_MONTH_DAYS * days,
  )

  return {
    anticipationDays: days,
    totalValueCents: input.totalValueCents,
    valueCents,
    feeCents,
    netValueCents: cents(valueCents - feeCents),
    monthlyRateBp,
  }
}
