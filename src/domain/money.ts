/**
 * Dinheiro. Inteiro em centavos, sempre.
 *
 * A conversão para reais acontece SÓ na borda (serialização da resposta). Toda
 * aritmética é inteira: as regras do Asaas são regras de resto exato ("a sobra
 * vai na última parcela") e só se expressam assim.
 */

/** Valor monetário em centavos. R$ 1,99 → 199. */
export type Cents = number & { readonly __brand: 'Cents' }

/** Percentual na escala 1e4 (4 casas decimais). 92,3444% → 923444. */
export type PercentE4 = number & { readonly __brand: 'PercentE4' }

/** Basis points: 1 bp = 0,01%. 2,99% → 299. */
export type BasisPoints = number & { readonly __brand: 'BasisPoints' }

export const cents = (n: number): Cents => n as Cents
export const percentE4 = (n: number): PercentE4 => n as PercentE4
export const bp = (n: number): BasisPoints => n as BasisPoints

/**
 * Arredondamento HALF-UP (0,5 sobe), não banker's rounding.
 * `Math.round` já é half-up para positivos, mas erra para negativos
 * (Math.round(-0.5) === -0), então tratamos o sinal explicitamente.
 */
export function roundCents(x: number): Cents {
  const r = Math.sign(x) * Math.round(Math.abs(x))
  return (r === 0 ? 0 : r) as Cents // normaliza -0
}

/** R$ 129,90 → 12990. Só para ler entrada da API. */
export function brlToCents(reais: number): Cents {
  return roundCents(reais * 100)
}

/**
 * 12990 → 129.9. Só para escrever resposta.
 *
 * Seguro apesar de 129.9 não ser exato em binário: JS imprime o menor decimal
 * que faz round-trip, então JSON.stringify(12990/100) === "129.9". O perigo está
 * na ARITMÉTICA, e ela nunca sai de centavos.
 */
export function centsToBrl(c: Cents): number {
  return c / 100
}

/** 299 bp → 2.99. Só para escrever resposta (a tabela de taxas da conta). */
export function bpToPercent(rate: BasisPoints): number {
  return rate / 100
}

/** Aplica um percentual em basis points. 10000 centavos × 299bp = 299 centavos. */
export function applyBp(value: Cents, rate: BasisPoints): Cents {
  return roundCents((value * rate) / 10_000)
}

/** Aplica um percentual na escala 1e4. Usado pelo split (4 casas decimais). */
export function applyPercentE4(value: Cents, pct: PercentE4): Cents {
  return roundCents((value * pct) / 1_000_000)
}

export const sumCents = (list: readonly Cents[]): Cents =>
  list.reduce<Cents>((a, b) => cents(a + b), cents(0))
