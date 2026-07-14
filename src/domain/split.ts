/**
 * Split de pagamentos. PURO.
 *
 * A REGRA QUE TODO MUNDO ERRA: o split incide sobre o **netValue** — o valor da
 * cobrança JÁ DESCONTADA a taxa do Asaas —, não sobre o valor bruto.
 *
 *   Cobrança de R$ 100,00 no Pix (taxa R$ 1,99) → netValue = R$ 98,01
 *   Split de 30%  → R$ 29,40  (30% de 98,01), NÃO R$ 30,00.
 *
 * Ou seja: quem emite a cobrança paga a taxa; o split reparte o que sobrou.
 *
 * Precisões (do Asaas):
 *   fixedValue      2 casas decimais → centavos
 *   percentualValue 4 casas decimais → escala 1e4 (92,3444% = 923444)
 */
import { applyPercentE4, cents, sumCents, type Cents, type PercentE4 } from './money.ts'
import { splitTotal } from './installments.ts'

export interface SplitSpec {
  walletId: string
  fixedValueCents?: Cents | null
  percentualValueE4?: PercentE4 | null
  externalReference?: string | null
  description?: string | null
}

export interface ComputedSplit {
  spec: SplitSpec
  totalValueCents: Cents
}

export interface SplitComputation {
  splits: ComputedSplit[]
  /** Soma de todos os splits. */
  totalCents: Cents
  /**
   * A soma excede o netValue. O Asaas BLOQUEIA o valor e dá 2 dias úteis para
   * ajustar; se não ajustar, cancela os splits.
   */
  divergent: boolean
  /** O que sobra para quem emitiu a cobrança. */
  remainderCents: Cents
}

/**
 * Calcula os splits sobre o netValue.
 *
 * Fixo e percentual podem coexistir na mesma cobrança e não há regra de
 * prioridade — o Asaas simplesmente soma.
 */
export function computeSplits(netValue: Cents, specs: readonly SplitSpec[]): SplitComputation {
  const splits: ComputedSplit[] = specs.map((spec) => {
    const fixed = spec.fixedValueCents ?? cents(0)
    const percentual = spec.percentualValueE4
      ? applyPercentE4(netValue, spec.percentualValueE4)
      : cents(0)

    return { spec, totalValueCents: cents(fixed + percentual) }
  })

  const totalCents = sumCents(splits.map((s) => s.totalValueCents))

  return {
    splits,
    totalCents,
    divergent: totalCents > netValue,
    remainderCents: cents(netValue - totalCents),
  }
}

/**
 * `totalFixedValue` num parcelamento: o valor é distribuído IGUALMENTE entre as
 * parcelas, com a sobra na última — a mesma regra da divisão de parcelas.
 *
 *   R$ 300 em 3x com totalFixedValue = R$ 100
 *     → R$ 33,33 | R$ 33,33 | R$ 33,34
 *
 * Já `fixedValue` (sem "total") é aplicado EM CADA parcela: R$ 10 em 4x = R$ 40
 * no total. São coisas diferentes e a nomenclatura não ajuda.
 */
export function distributeTotalFixedValue(totalFixed: Cents, installments: number): Cents[] {
  return splitTotal(totalFixed, installments)
}

export interface SplitValidationError {
  code: string
  description: string
}

/** Validações que o Asaas faz no momento de criar/atualizar o split. */
export function validateSplits(
  specs: readonly SplitSpec[],
  ownWalletId: string,
): SplitValidationError[] {
  const errors: SplitValidationError[] = []

  for (const spec of specs) {
    if (!spec.walletId) {
      errors.push({
        code: 'invalid_split',
        description: 'O walletId é obrigatório para cada split.',
      })
      continue
    }

    // O Asaas retorna exceção se você tentar splitar para si mesmo.
    if (spec.walletId === ownWalletId) {
      errors.push({
        code: 'invalid_split',
        description: 'Não é possível informar a própria carteira no split.',
      })
    }

    const hasFixed = (spec.fixedValueCents ?? 0) > 0
    const hasPercentual = (spec.percentualValueE4 ?? 0) > 0

    if (!hasFixed && !hasPercentual) {
      errors.push({
        code: 'invalid_split',
        description: 'Informe fixedValue ou percentualValue no split.',
      })
    }

    if ((spec.percentualValueE4 ?? 0) > 1_000_000) {
      errors.push({
        code: 'invalid_split',
        description: 'O percentualValue não pode ser maior que 100.',
      })
    }
  }

  return errors
}
