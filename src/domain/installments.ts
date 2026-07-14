/**
 * Divisão de parcelas. PURO.
 *
 * A REGRA: a sobra de arredondamento vai na ÚLTIMA parcela.
 *
 *   R$ 350,00 em 12x → 11 × R$ 29,16 + 1 × R$ 29,24
 *
 * (350/12 = 29,1666… → 29,16 por parcela; 11 × 29,16 = 320,76; 350 − 320,76 =
 * 29,24 na última.) É por isso que dinheiro é inteiro em centavos aqui: essa é
 * uma regra de resto exato e não sobrevive a ponto flutuante.
 *
 * Esta é a linha 1 do golden test — se algum dia divergir do Asaas real, é aqui
 * que se descobre.
 */
import { addMonths, type IsoDate } from './calendar.ts'
import { cents, type Cents } from './money.ts'

/**
 * Divide `total` em `count` parcelas. Sobra na última.
 * A soma do resultado é SEMPRE exatamente `total`.
 */
export function splitTotal(total: Cents, count: number): Cents[] {
  if (count < 1) throw new Error('installmentCount deve ser >= 1')
  if (count === 1) return [total]

  const base = Math.floor(total / count)
  const parts: Cents[] = Array.from({ length: count - 1 }, () => cents(base))
  const last = cents(total - base * (count - 1))
  parts.push(last)
  return parts
}

/**
 * O caminho inverso: o cliente informa o valor DA PARCELA e a quantidade.
 * Aqui não há sobra — o total é simplesmente valor × quantidade.
 */
export function totalFromInstallmentValue(installmentValue: Cents, count: number): Cents {
  return cents(installmentValue * count)
}

/** Os vencimentos: mensais, a partir do vencimento da 1ª parcela. */
export function installmentDueDates(firstDueDate: IsoDate, count: number): IsoDate[] {
  return Array.from({ length: count }, (_, i) => addMonths(firstDueDate, i))
}

/**
 * Cartão de crédito: Visa/Mastercard aceitam até 21x; as demais bandeiras, 12x.
 * (Regra do Asaas, não da adquirente.)
 */
export function maxInstallmentsForBrand(brand: string): number {
  return brand === 'VISA' || brand === 'MASTERCARD' ? 21 : 12
}
