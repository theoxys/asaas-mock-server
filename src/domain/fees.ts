/**
 * Taxas do Asaas. PURO.
 *
 * A taxa só é cobrada quando a cobrança é PAGA — emitir boleto/Pix/cobrança não
 * custa nada. Por isso `feeCents` é calculado na criação (para poder informar o
 * `netValue`) mas só é debitado do saldo na liquidação.
 *
 * Os valores vêm da tabela pública de preços e são CONFIGURÁVEIS (src/core/config).
 * Foram pesquisados na documentação, não provados contra a API real — quando
 * descobrirmos uma divergência, a correção é mudar a config, não este código.
 */
import type { FeeTable } from '../core/config.ts'
import { applyBp, cents, type Cents } from './money.ts'

export type BillingType =
  | 'BOLETO'
  | 'PIX'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'UNDEFINED'
  | 'TRANSFER'
  | 'DEPOSIT'

/** A faixa percentual do cartão de crédito depende do número de parcelas. */
function creditCardRate(fees: FeeTable, installments: number) {
  if (installments <= 1) return fees.creditCard.oneInstallment
  if (installments <= 6) return fees.creditCard.upToSix
  if (installments <= 12) return fees.creditCard.upToTwelve
  return fees.creditCard.upToTwentyOne
}

/**
 * A taxa cobrada por UMA cobrança.
 *
 * `installments` é o total de parcelas do parcelamento (1 = à vista) — usado só
 * para escolher a faixa percentual do cartão. A taxa incide sobre o valor DESTA
 * cobrança (a parcela), não sobre o total do parcelamento.
 *
 * Para CARTÃO PARCELADO isto NÃO é a função certa — use `calcInstallmentFee`.
 * PROVADO contra o sandbox real: o Asaas cobra a taxa do cartão UMA vez sobre o
 * TOTAL e divide entre as parcelas. Cobrar `fixed + pct` por parcela (o que esta
 * função faria) dá um número maior e errado.
 */
export function calcFee(
  fees: FeeTable,
  billingType: BillingType,
  value: Cents,
  installments = 1,
): Cents {
  switch (billingType) {
    case 'BOLETO':
      return fees.boleto

    case 'PIX':
      // Valor FIXO, não percentual. É contraintuitivo e as pessoas erram.
      return fees.pix

    case 'CREDIT_CARD':
      return cents(fees.creditCard.fixed + applyBp(value, creditCardRate(fees, installments)))

    case 'DEBIT_CARD':
      return cents(fees.debitCard.fixed + applyBp(value, fees.debitCard.pct))

    // A cobrança ainda não sabe como será paga: sem taxa até a liquidação
    // definir o meio de pagamento de fato.
    case 'UNDEFINED':
    case 'TRANSFER':
    case 'DEPOSIT':
      return cents(0)
  }
}

/**
 * A taxa de CADA parcela de um parcelamento. PROVADO contra o sandbox real.
 *
 * Os dois meios se comportam de formas opostas, e é fácil errar:
 *
 *   BOLETO — a taxa é POR BOLETO EMITIDO. R$ 350 em 12x → 12 × R$ 1,99 = R$ 23,88.
 *            (netValue do parcelamento: 350 − 23,88 = 326,12 ✓ sandbox)
 *
 *   CARTÃO — a taxa é calculada UMA VEZ sobre o TOTAL e depois DIVIDIDA entre as
 *            parcelas. R$ 600 em 6x → (0,49 + 3,49% × 600) = 21,43; 21,43/6 =
 *            3,5716 → R$ 3,57 por parcela. (netValue: 6 × 96,43 = 578,58 ✓ sandbox)
 *
 *            Repare que 6 × 3,57 = 21,42, um centavo A MENOS que os 21,43
 *            calculados. O Asaas NÃO redistribui essa sobra — ela simplesmente
 *            fica com o lojista. Reproduzimos isso: arredondar para cima ou jogar
 *            o resto na última parcela daria um netValue diferente do real.
 *
 * A divisão TRUNCA, não arredonda — e a diferença é observável:
 *
 *   R$ 350 em 12x → taxa total = 0,49 + 3,99% × 350 = R$ 14,455 → 1446 centavos.
 *   1446/12 = 120,5. Arredondando dá 121; truncando dá 120.
 *   O sandbox real devolve netValue 27,96 sobre uma parcela de 29,16 → taxa
 *   de R$ 1,20. É TRUNCAMENTO. Com Math.round errávamos um centavo por parcela.
 *
 * A faixa percentual do cartão é escolhida pelo NÚMERO DE PARCELAS (2-6 → 3,49%),
 * e incide sobre o total — não sobre o valor da parcela.
 */
export function calcInstallmentFee(
  fees: FeeTable,
  billingType: BillingType,
  totalValue: Cents,
  installmentCount: number,
): Cents {
  if (billingType !== 'CREDIT_CARD') {
    // Boleto, Pix e débito: a taxa é por cobrança, e cada parcela é uma cobrança.
    return calcFee(fees, billingType, totalValue, installmentCount)
  }

  const total = fees.creditCard.fixed + applyBp(totalValue, creditCardRate(fees, installmentCount))
  return cents(Math.floor(total / installmentCount))
}

/** netValue = value − taxa do Asaas. É a base sobre a qual o split incide. */
export function netValue(value: Cents, fee: Cents): Cents {
  return cents(value - fee)
}
