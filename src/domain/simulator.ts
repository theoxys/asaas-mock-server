/**
 * Simulador de vendas — `POST /v3/payments/simulate`. PURO.
 *
 * Responde "se eu cobrar R$ X por este meio, quanto me sobra?" sem criar nada.
 *
 * As três chaves (`creditCard`, `bankSlip`, `pix`) SEMPRE saem; as que não foram
 * pedidas em `billingTypes` saem `null`. Provado contra o sandbox real — omitir
 * as chaves quebraria um cliente que faz `res.pix.netValue` sem checar.
 *
 * A aritmética das parcelas, capturada do sandbox (100 em 3x, 100 em 1x, 350 em 12x):
 *
 *   paymentValue     = TRUNC(value / N)          → 350/12 = 29,16 (não 29,17)
 *   taxa por parcela = ver abaixo, e TRUNCA
 *   paymentNetValue  = paymentValue − taxaPorParcela
 *   netValue         = value − N × taxaPorParcela
 *
 * E os dois meios se comportam de forma OPOSTA na taxa, que é a pegadinha:
 *
 *   CARTÃO — taxa calculada UMA VEZ sobre o total (0,49 + pct% × value) e
 *            DIVIDIDA entre as parcelas.  100 em 3x → 3,98/3 = 1,32 por parcela.
 *   BOLETO/PIX — taxa fixa POR PARCELA, não dividida. Cada parcela é um boleto
 *            emitido, e cada boleto custa R$ 1,99.  100 em 3x → 1,99 por parcela.
 *
 * `netValue` cai de 100 para 94,03 no boleto em 3x, mas só para 96,04 no cartão.
 * Parcelar no boleto é mais caro que no cartão — é contraintuitivo, e é real.
 */
import type { FeeTable } from '../core/config.ts'
import { calcFee, calcInstallmentFee, type BillingType } from './fees.ts'
import { cents, type Cents } from './money.ts'

export interface SimulationInput {
  valueCents: Cents
  billingTypes: readonly BillingType[]
  installmentCount?: number | null
}

export interface SimulatedInstallment {
  paymentNetValueCents: Cents
  paymentValueCents: Cents
}

export interface SimulatedBilling {
  netValueCents: Cents
  /** Só o cartão tem faixa percentual; boleto e Pix cobram valor fixo. */
  feeBp: number | null
  feeFixedCents: Cents
  installment: SimulatedInstallment | null
}

export interface Simulation {
  valueCents: Cents
  creditCard: SimulatedBilling | null
  bankSlip: SimulatedBilling | null
  pix: SimulatedBilling | null
}

/** A faixa percentual do cartão, em basis points, para N parcelas. */
function creditCardBp(fees: FeeTable, n: number): number {
  if (n <= 1) return fees.creditCard.oneInstallment
  if (n <= 6) return fees.creditCard.upToSix
  if (n <= 12) return fees.creditCard.upToTwelve
  return fees.creditCard.upToTwentyOne
}

function simulateOne(
  fees: FeeTable,
  billingType: BillingType,
  value: Cents,
  count: number,
): SimulatedBilling {
  const isCard = billingType === 'CREDIT_CARD'

  const feeBp = isCard ? creditCardBp(fees, count) : null
  const feeFixed = isCard ? cents(fees.creditCard.fixed) : calcFee(fees, billingType, value, count)

  // À vista: uma cobrança só, taxa cheia sobre o valor cheio.
  if (count <= 1) {
    const fee = calcFee(fees, billingType, value, 1)
    return {
      netValueCents: cents(value - fee),
      feeBp,
      feeFixedCents: feeFixed,
      installment: null,
    }
  }

  const perInstallmentFee = calcInstallmentFee(fees, billingType, value, count)
  const paymentValue = cents(Math.floor(value / count))

  return {
    // A sobra do truncamento fica com o lojista — não é redistribuída.
    netValueCents: cents(value - perInstallmentFee * count),
    feeBp,
    feeFixedCents: feeFixed,
    installment: {
      paymentValueCents: paymentValue,
      paymentNetValueCents: cents(paymentValue - perInstallmentFee),
    },
  }
}

export function simulate(fees: FeeTable, input: SimulationInput): Simulation {
  const count = Math.max(1, Number(input.installmentCount ?? 1))
  const wanted = new Set(input.billingTypes)

  const of = (t: BillingType) =>
    wanted.has(t) ? simulateOne(fees, t, input.valueCents, count) : null

  return {
    valueCents: input.valueCents,
    creditCard: of('CREDIT_CARD'),
    bankSlip: of('BOLETO'),
    pix: of('PIX'),
  }
}
