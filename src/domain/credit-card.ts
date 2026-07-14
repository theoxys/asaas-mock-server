/**
 * Cartão de crédito: bandeira, validação e os cartões de teste. PURO.
 *
 * Não toca banco, relógio nem HTTP — recebe o número (e o `now`) e devolve DADOS.
 *
 * O que este arquivo garante, e que é a razão de ele existir:
 *
 *   1. O PAN COMPLETO NUNCA SAI DAQUI. `inspectCard` devolve `last4`, bandeira e
 *      o desfecho simulado — nunca o número. Quem chama não tem como persistir o
 *      PAN por descuido, porque nunca o recebe de volta.
 *
 *   2. Os cartões de teste e as mensagens de erro são DADOS, não `if`s espalhados
 *      pelo handler. O painel serve a MESMA tabela que o motor consulta — não há
 *      como a tela documentar um cartão que o servidor não honra.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TUDO ABAIXO FOI CAPTURADO DO SANDBOX REAL (tools/probe-cards.ts), não deduzido.
 * A captura derrubou quatro coisas que este arquivo afirmava:
 *
 *   • A recusa NÃO é `invalid_creditCard`. É **`invalid_action`**, com outra
 *     frase. Um cliente que ramifica por `code` se comportava diferente contra o
 *     mock e contra o Asaas — que é exatamente o bug que este projeto existe para
 *     não ter.
 *
 *   • O Asaas NÃO valida Luhn. `4111111111111112` (dígito verificador errado)
 *     é APROVADO lá. Nós recusávamos: um cartão que funcionava em produção
 *     quebrava no teste local. Luhn continua exportado — serve para o painel
 *     sugerir números plausíveis — mas NÃO recusa mais nada.
 *
 *   • O CVV de 1 dígito é ACEITO. Só o vazio é recusado.
 *
 *   • Cartão expirado é RECUSADO — e nós nem olhávamos a data.
 *
 * Se você mudar qualquer mensagem daqui, rode `bun tools/probe-cards.ts` contra o
 * sandbox e prove que o Asaas mudou primeiro.
 * ─────────────────────────────────────────────────────────────────────────────
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

/**
 * O desfecho simulado de um cartão.
 *
 * `APPROVE` e `DECLINE` são desfechos de AUTORIZAÇÃO: o cartão é válido, entra no
 * cofre, vira token — e só na hora de cobrar é que a "adquirente" responde. Os
 * demais são de VALIDAÇÃO: o Asaas recusa a requisição na porta, e nenhum token
 * nasce.
 *
 * A distinção não é acadêmica: um cartão `DECLINE` tokenizado continua recusando
 * quando cobrado pelo token, e é assim que o Asaas se comporta.
 */
export type SimulatedOutcome =
  | 'APPROVE'
  | 'DECLINE'
  | 'EXPIRED'
  | 'INVALID_NUMBER'
  | 'INVALID_MONTH'
  | 'MISSING_CVV'
  | 'MISSING_HOLDER'

/** Os desfechos que sobrevivem à validação e viram token. */
export type AuthorizationOutcome = Extract<SimulatedOutcome, 'APPROVE' | 'DECLINE'>

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

/**
 * As mensagens do Asaas, LETRA A LETRA. Inclusive o "invalido" sem acento em
 * INVALID_MONTH — o typo é deles, e reproduzi-lo é o ponto: um cliente que
 * compara a string encontra a mesma string aqui e lá.
 */
export const CARD_ERRORS: Readonly<
  Record<Exclude<SimulatedOutcome, 'APPROVE'>, { code: string; description: string }>
> = {
  DECLINE: {
    code: 'invalid_action',
    description:
      'Transação não autorizada. Verifique os dados do cartão de crédito e tente novamente.',
  },
  INVALID_NUMBER: {
    code: 'invalid_creditCard',
    description:
      'O número do cartão é inválido. Verifique se todos os números foram informados corretamente.',
  },
  EXPIRED: {
    code: 'invalid_creditCard',
    description: 'O cartão informado está expirado.',
  },
  INVALID_MONTH: {
    code: 'invalid_creditCard',
    description: 'O mês de vencimento do cartão é invalido.',
  },
  MISSING_CVV: {
    code: 'invalid_creditCard',
    description: 'Informe o código de segurança do seu cartão.',
  },
  MISSING_HOLDER: {
    code: 'invalid_creditCard',
    description: 'Informe o nome do portador.',
  },
}

const errorFor = (outcome: Exclude<SimulatedOutcome, 'APPROVE'>) => {
  const e = CARD_ERRORS[outcome]
  return new CreditCardError(e.code, e.description)
}

/** Uma linha da tabela de cartões de teste. É o que o painel exibe. */
export interface TestCard {
  number: string
  outcome: SimulatedOutcome
  /** O que este cartão faz, em português, para a tela. */
  label: string
  /**
   * `true` quando o SANDBOX REAL do Asaas faz a mesma coisa com este número.
   *
   * `false` é uma extensão nossa: no Asaas de verdade o número seria APROVADO.
   * A distinção precisa aparecer no painel, senão alguém escreve um teste contra
   * um comportamento que só existe aqui e descobre em produção.
   */
  real: boolean
}

/**
 * A tabela. É DADO, e é injetável.
 *
 * Os quatro primeiros foram verificados contra o sandbox. Os três seguintes são
 * SIMULAÇÃO: números da indústria (os "canônicos" que todo dev reconhece) que no
 * Asaas real aprovariam — aqui forçam um erro, para que dê para exercitar o
 * tratamento de erro trocando um número em vez de forjar um payload.
 *
 * Por que só estes três, e não um cartão por erro? Porque `MISSING_CVV` e
 * `MISSING_HOLDER` são propriedades de OUTROS campos. Um número que devolvesse
 * "Informe o nome do portador" quando o nome FOI informado seria uma mensagem
 * mentirosa. Esses erros se disparam quebrando o campo — que é como o Asaas os
 * produz. `TRIGGERS` abaixo diz como.
 */
export type TestCardTable = readonly TestCard[]

export const TEST_CARDS: TestCardTable = [
  { number: '5162306219378829', outcome: 'APPROVE', label: 'Aprova', real: true },
  { number: '4444444444444444', outcome: 'APPROVE', label: 'Aprova', real: true },
  { number: '5184019740373151', outcome: 'DECLINE', label: 'Recusa do emissor', real: true },
  { number: '4916561358240741', outcome: 'DECLINE', label: 'Recusa do emissor', real: true },

  { number: '4000000000000002', outcome: 'DECLINE', label: 'Recusa do emissor', real: false },
  { number: '4000000000000069', outcome: 'EXPIRED', label: 'Cartão expirado', real: false },
  { number: '4000000000000101', outcome: 'INVALID_NUMBER', label: 'Número inválido', real: false },
]

/**
 * Os erros que NÃO se disparam por número, e o campo que os produz. O painel
 * mostra isto ao lado da tabela: sem ele, três dos seis erros do Asaas ficariam
 * sem forma de exercitar.
 */
export const TRIGGERS: ReadonlyArray<{
  outcome: Exclude<SimulatedOutcome, 'APPROVE' | 'DECLINE'>
  label: string
  how: string
}> = [
  { outcome: 'EXPIRED', label: 'Cartão expirado', how: 'expiryYear no passado (ex.: 2020)' },
  { outcome: 'INVALID_MONTH', label: 'Mês inválido', how: 'expiryMonth = 13' },
  { outcome: 'MISSING_CVV', label: 'CVV ausente', how: 'ccv = "" (1 dígito é aceito!)' },
  { outcome: 'MISSING_HOLDER', label: 'Titular ausente', how: 'holderName = ""' },
  { outcome: 'INVALID_NUMBER', label: 'Número inválido', how: 'number com menos de 13 dígitos' },
]

/**
 * Prefixos por bandeira. O match é por PREFIXO MAIS LONGO — `6011` (Discover)
 * ganha de `6` (Elo).
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
 * O algoritmo de Luhn (mod 10).
 *
 * ATENÇÃO: **o Asaas não usa isto para recusar** — foi capturado. Continua aqui
 * porque é útil para gerar números plausíveis, não para julgar os que chegam.
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
 * O desfecho simulado. `null` quando o número não está na tabela — e aí o cartão
 * segue o caminho normal: qualquer número bem-formado APROVA, como no Asaas.
 */
export function outcomeFor(
  number: string,
  table: TestCardTable = TEST_CARDS,
): SimulatedOutcome | null {
  const n = normalizeCardNumber(number)
  return table.find((c) => c.number === n)?.outcome ?? null
}

/** Os dados crus do cartão, como chegam no body. */
export interface CardInput {
  number: string
  holderName?: string
  expiryMonth?: string
  expiryYear?: string
  ccv?: string
}

/** O cartão, sem o PAN. É EXATAMENTE isto que pode ser persistido ou serializado. */
export interface CardInfo {
  last4: string
  brand: CardBrand
  /** Só APPROVE ou DECLINE chegam aqui: o resto já virou exceção. */
  outcome: AuthorizationOutcome
}

/**
 * `true` se o cartão já venceu. O mês de vencimento é INCLUSIVO — um cartão
 * 05/2026 vale até 31/05/2026. É a convenção da indústria, e errá-la recusaria
 * cartões bons no último mês de vida deles.
 */
export function isExpired(month: number, year: number, now: Date): boolean {
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth() + 1
  return year < nowYear || (year === nowYear && month < nowMonth)
}

/**
 * Valida o cartão e devolve o que dá para guardar. Lança `CreditCardError`.
 *
 * A tabela de teste é consultada ANTES da validação: um cartão de teste é válido
 * por decreto (`4444444444444444` nem passa no Luhn, e o Asaas o aprova), e um
 * cartão de simulação precisa poder forçar o seu erro mesmo estando bem-formado.
 *
 * `now` entra porque "expirado" é a única regra aqui que depende do tempo — e o
 * relógio virtual precisa alcançá-la, senão avançar 5 anos não expiraria cartão
 * nenhum.
 */
export function inspectCard(
  card: CardInput,
  now: Date,
  table: TestCardTable = TEST_CARDS,
): CardInfo {
  const number = normalizeCardNumber(card.number)
  const simulated = outcomeFor(number, table)

  // Um cartão de simulação dispara o SEU erro e ignora o resto — é o que ele é.
  if (simulated !== null && simulated !== 'APPROVE' && simulated !== 'DECLINE') {
    throw errorFor(simulated)
  }

  // Luhn NÃO entra aqui. Ver o cabeçalho: o Asaas aceita dígito verificador errado.
  if (simulated === null && !/^\d{13,19}$/.test(number)) {
    throw errorFor('INVALID_NUMBER')
  }

  if (card.holderName !== undefined && String(card.holderName).trim() === '') {
    throw errorFor('MISSING_HOLDER')
  }

  const month = card.expiryMonth === undefined ? undefined : Number(card.expiryMonth)
  if (month !== undefined) {
    if (!/^\d{1,2}$/.test(String(card.expiryMonth)) || month < 1 || month > 12) {
      throw errorFor('INVALID_MONTH')
    }
  }

  if (card.expiryYear !== undefined) {
    if (!/^\d{4}$/.test(String(card.expiryYear))) throw errorFor('INVALID_MONTH')
    if (month !== undefined && isExpired(month, Number(card.expiryYear), now)) {
      throw errorFor('EXPIRED')
    }
  }

  // Só o CVV VAZIO é recusado. Um dígito passa — foi capturado, por mais estranho
  // que pareça.
  if (card.ccv !== undefined && String(card.ccv).trim() === '') {
    throw errorFor('MISSING_CVV')
  }

  return {
    last4: number.slice(-4),
    brand: detectBrand(number),
    // Um cartão bem-formado que não está na tabela APROVA.
    outcome: simulated === 'DECLINE' ? 'DECLINE' : 'APPROVE',
  }
}
