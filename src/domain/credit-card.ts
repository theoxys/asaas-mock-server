/**
 * Cartão de crédito: Luhn, bandeira e os cartões de teste do sandbox. PURO.
 *
 * Não toca banco, relógio nem HTTP — recebe o número e devolve DADOS.
 *
 * O que este arquivo garante, e que é a razão de ele existir:
 *
 *   1. O PAN COMPLETO NUNCA SAI DAQUI. `inspectCard` devolve `last4`, bandeira e
 *      o desfecho simulado — nunca o número. Quem chama não tem como persistir o
 *      PAN por descuido, porque nunca o recebe de volta.
 *
 *   2. Os cartões de teste são DADOS (`TEST_CARDS`), não `if`s espalhados pelo
 *      handler. A tabela é injetável, então uma integração que precise de outro
 *      PAN de recusa muda a tabela, não o código.
 *
 * A tabela do sandbox do Asaas:
 *   4444 4444 4444 4444  → aprova
 *   5184 0197 4037 3151  → recusa
 *   4916 5613 5824 0741  → recusa
 *
 * Detalhe que morde: `4444444444444444` NÃO passa no algoritmo de Luhn. Por isso
 * a tabela de teste é consultada ANTES da validação — um cartão de teste é
 * válido por decreto. Qualquer outro número precisa passar no Luhn.
 */

/**
 * O enum `CreditCardBrand` da spec, na íntegra — a resposta é validada contra
 * ele. `BRAND_RULES` só sabe detectar um subconjunto; o resto existe para quem
 * quiser estender a tabela sem mexer no tipo.
 */
export type CardBrand =
  | 'VISA'
  | 'MASTERCARD'
  | 'ELO'
  | 'DINERS'
  | 'DISCOVER'
  | 'AMEX'
  | 'CABAL'
  | 'BANESCARD'
  | 'CREDZ'
  | 'SOROCRED'
  | 'CREDSYSTEM'
  | 'JCB'
  | 'UNKNOWN'

/** O que a "adquirente" simulada vai responder quando este cartão for usado. */
export type SimulatedOutcome = 'APPROVE' | 'DECLINE'

/** Erro de domínio. Puro — a borda traduz para o formato de erro do Asaas. */
export class CreditCardError extends Error {
  constructor(
    readonly code: string,
    readonly description: string,
  ) {
    super(description)
    this.name = 'CreditCardError'
  }
}

/** A tabela de cartões de teste do sandbox. É DADO, e é injetável. */
export type TestCardTable = Readonly<Record<string, SimulatedOutcome>>

export const TEST_CARDS: TestCardTable = {
  '4444444444444444': 'APPROVE',
  '5184019740373151': 'DECLINE',
  '4916561358240741': 'DECLINE',
}

/**
 * Prefixos por bandeira. O match é por PREFIXO MAIS LONGO — `6011` (Discover)
 * ganha de `6` (Elo).
 *
 * TODO(regra): as faixas reais de BIN são bem mais granulares (Elo tem ~40
 * faixas, Mastercard usa 51–55 + 2221–2720, JCB usa 3528–3589). Aqui usamos os
 * prefixos que a documentação do Asaas cita nos exemplos. Basta um número de
 * teste divergir para valer a pena refinar — e a mudança é só esta tabela.
 */
export interface BrandRule {
  brand: CardBrand
  prefixes: readonly string[]
}

export const BRAND_RULES: readonly BrandRule[] = [
  { brand: 'AMEX', prefixes: ['34', '37'] },
  { brand: 'DINERS', prefixes: ['30', '36', '38'] },
  { brand: 'JCB', prefixes: ['35'] },
  { brand: 'DISCOVER', prefixes: ['6011', '644', '645', '646', '647', '648', '649', '65'] },
  { brand: 'ELO', prefixes: ['6'] },
  { brand: 'VISA', prefixes: ['4'] },
  { brand: 'MASTERCARD', prefixes: ['5', '2'] },
]

/** Tira espaços e hifens. `4444 4444 4444 4444` → `4444444444444444`. */
export function normalizeCardNumber(raw: string): string {
  return String(raw ?? '').replace(/[\s.-]/g, '')
}

/**
 * O algoritmo de Luhn (mod 10). Dobra um dígito sim, um não, da direita para a
 * esquerda; soma; o total tem que fechar em múltiplo de 10.
 */
export function luhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false

  let sum = 0
  let double = false

  for (let i = number.length - 1; i >= 0; i--) {
    let digit = number.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return sum % 10 === 0
}

/** A bandeira, pelo prefixo. `UNKNOWN` quando nenhuma faixa bate. */
export function detectBrand(number: string, rules: readonly BrandRule[] = BRAND_RULES): CardBrand {
  const n = normalizeCardNumber(number)

  let best: { brand: CardBrand; len: number } | null = null
  for (const rule of rules) {
    for (const prefix of rule.prefixes) {
      if (n.startsWith(prefix) && (best === null || prefix.length > best.len)) {
        best = { brand: rule.brand, len: prefix.length }
      }
    }
  }

  return best?.brand ?? 'UNKNOWN'
}

/**
 * O desfecho simulado. `null` quando o número não está na tabela de teste — o
 * chamador decide o default (é APPROVE: um cartão válido qualquer aprova).
 */
export function outcomeFor(
  number: string,
  table: TestCardTable = TEST_CARDS,
): SimulatedOutcome | null {
  return table[normalizeCardNumber(number)] ?? null
}

/** Os dados crus do cartão, como chegam no body. */
export interface CardInput {
  number: string
  holderName?: string
  expiryMonth?: string
  expiryYear?: string
  ccv?: string
}

/**
 * O cartão, sem o PAN. É EXATAMENTE isto que pode ser persistido ou serializado.
 */
export interface CardInfo {
  last4: string
  brand: CardBrand
  outcome: SimulatedOutcome
}

const invalidCard = (description: string) => new CreditCardError('invalid_creditCard', description)

/**
 * Valida o cartão e devolve o que dá para guardar. Lança `CreditCardError`.
 *
 * A ordem importa: a tabela de teste vem ANTES do Luhn (ver o comentário do topo).
 */
export function inspectCard(card: CardInput, table: TestCardTable = TEST_CARDS): CardInfo {
  const number = normalizeCardNumber(card.number)

  if (!/^\d{13,19}$/.test(number)) {
    throw invalidCard('O número do cartão de crédito informado é inválido.')
  }

  const known = outcomeFor(number, table)
  if (known === null && !luhn(number)) {
    throw invalidCard('O número do cartão de crédito informado é inválido.')
  }

  if (card.expiryMonth !== undefined) {
    const month = Number(card.expiryMonth)
    if (!/^\d{1,2}$/.test(String(card.expiryMonth)) || month < 1 || month > 12) {
      throw invalidCard('O mês de expiração do cartão de crédito é inválido.')
    }
  }
  if (card.expiryYear !== undefined && !/^\d{4}$/.test(String(card.expiryYear))) {
    throw invalidCard('O ano de expiração do cartão de crédito é inválido.')
  }
  if (card.ccv !== undefined && !/^\d{3,4}$/.test(String(card.ccv))) {
    throw invalidCard('O código de segurança do cartão de crédito é inválido.')
  }

  return {
    last4: number.slice(-4),
    brand: detectBrand(number),
    // Um cartão válido que não está na tabela de teste aprova.
    outcome: known ?? 'APPROVE',
  }
}
