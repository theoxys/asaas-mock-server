/**
 * Luhn, bandeira e cartões de teste — puro, table-driven, sem subir nada.
 */
import { describe, expect, it } from 'bun:test'
import {
  BRAND_RULES,
  CARD_ERRORS,
  CreditCardError,
  declinesOnCharge,
  declinesOnTokenize,
  detectBrand,
  inspectCard,
  isExpired,
  luhn,
  normalizeCardNumber,
  outcomeFor,
  TEST_CARDS,
  type AuthorizationOutcome,
  type CardBrand,
} from '../../src/domain/credit-card.ts'
import { maxInstallmentsForBrand } from '../../src/domain/installments.ts'

describe('Luhn', () => {
  const cases: [string, boolean][] = [
    ['4111111111111111', true], // Visa clássico
    ['5555555555554444', true], // Mastercard
    ['378282246310005', true], // Amex (15 dígitos)
    ['30569309025904', true], // Diners (14 dígitos)
    ['6011111111111117', true], // Discover
    ['5184019740373151', true], // o cartão de recusa do sandbox É válido
    ['4916561358240741', true],
    ['5184019740373152', false], // um dígito trocado
    ['1234567890123456', false],
    ['4444444444444444', false], // ← o cartão que APROVA no sandbox falha no Luhn
    ['', false],
    ['4111-1111-1111-111a', false],
  ]

  for (const [number, expected] of cases) {
    it(`${number || '(vazio)'} → ${expected}`, () => {
      expect(luhn(number)).toBe(expected)
    })
  }
})

describe('bandeira pelo prefixo', () => {
  const cases: [string, CardBrand][] = [
    ['4111111111111111', 'VISA'],
    ['4444444444444444', 'VISA'],
    ['5184019740373151', 'MASTERCARD'],
    ['5555555555554444', 'MASTERCARD'],
    ['378282246310005', 'AMEX'],
    ['341111111111111', 'AMEX'],
    ['30569309025904', 'DINERS'],
    ['36700102000000', 'DINERS'],
    ['38520000023237', 'DINERS'],
    ['6011111111111117', 'DISCOVER'],
    ['6362970000457013', 'ELO'],
    ['3530111333300000', 'JCB'],
    ['9999999999999999', 'UNKNOWN'],
  ]

  for (const [number, brand] of cases) {
    it(`${number} → ${brand}`, () => {
      expect(detectBrand(number)).toBe(brand)
    })
  }

  it('o prefixo mais longo ganha: 6011 é DISCOVER, não ELO', () => {
    expect(detectBrand('6011111111111117')).toBe('DISCOVER')
    expect(detectBrand('6362970000457013')).toBe('ELO')
  })

  it('a tabela de prefixos é dado — dá para injetar outra', () => {
    const rules = [...BRAND_RULES, { brand: 'CABAL', prefixes: ['9'] } as const]
    expect(detectBrand('9999999999999999', rules)).toBe('CABAL')
  })
})

describe('cartões de teste do sandbox', () => {
  it('4444444444444444 aprova', () => {
    expect(outcomeFor('4444444444444444')).toBe('APPROVE')
  })

  it('5184019740373151 e 4916561358240741 recusam', () => {
    expect(outcomeFor('5184019740373151')).toBe('DECLINE')
    expect(outcomeFor('4916561358240741')).toBe('DECLINE')
  })

  it('qualquer outro número não está na tabela', () => {
    expect(outcomeFor('4111111111111111')).toBeNull()
  })

  it('espaços e hifens não mudam nada', () => {
    expect(normalizeCardNumber('4444 4444-4444 4444')).toBe('4444444444444444')
    expect(outcomeFor('4444 4444 4444 4444')).toBe('APPROVE')
  })

  it('a tabela é injetável', () => {
    const custom = [
      ...TEST_CARDS,
      { number: '4111111111111111', outcome: 'DECLINE' as const, label: 'x', real: false },
    ]
    expect(outcomeFor('4111111111111111', custom)).toBe('DECLINE')
  })
})

/**
 * NOW é fixo: "expirado" é a única regra deste arquivo que depende do tempo, e um
 * teste que use o relógio da máquina passa hoje e quebra em 2031.
 */
const NOW = new Date('2026-07-14T12:00:00Z')

describe('inspectCard', () => {
  it('devolve só os 4 últimos dígitos — nunca o número', () => {
    const info = inspectCard(
      {
        number: '4444444444444444',
        holderName: 'John Doe',
        expiryMonth: '12',
        expiryYear: '2030',
        ccv: '123',
      },
      NOW,
    )

    expect(info).toEqual({ last4: '4444', brand: 'VISA', outcome: 'APPROVE' })
    // O PAN não sobrevive: não existe campo nenhum com 16 dígitos no resultado.
    expect(JSON.stringify(info)).not.toContain('4444444444444444')
  })

  it('um cartão válido qualquer aprova', () => {
    expect(inspectCard({ number: '4111111111111111' }, NOW).outcome).toBe('APPROVE')
  })

  it('o cartão de recusa devolve DECLINE (mas é um cartão bem-formado)', () => {
    const info = inspectCard({ number: '5184019740373151' }, NOW)
    expect(info).toEqual({ last4: '3151', brand: 'MASTERCARD', outcome: 'DECLINE' })
  })

  /**
   * O Asaas NÃO valida Luhn — capturado do sandbox. Este teste é o que impede
   * alguém de "consertar" isso de volta: recusar aqui um número que o Asaas
   * aprova faz um cartão bom quebrar no teste local e passar em produção.
   */
  it('NÃO valida Luhn — o Asaas aprova dígito verificador errado', () => {
    expect(luhn('4111111111111112')).toBe(false)
    expect(inspectCard({ number: '4111111111111112' }, NOW).outcome).toBe('APPROVE')

    expect(luhn('4444444444444444')).toBe(false)
    expect(inspectCard({ number: '4444444444444444' }, NOW).outcome).toBe('APPROVE')
  })

  it('CVV de 1 dígito é ACEITO — só o vazio é recusado', () => {
    expect(inspectCard({ number: '4111111111111111', ccv: '1' }, NOW).outcome).toBe('APPROVE')
  })

  /** Cada caso: o (code, description) EXATO que o sandbox devolveu. */
  const rejects = (
    card: Parameters<typeof inspectCard>[0],
    expected: { code: string; description: string },
    why: string,
  ) => {
    it(why, () => {
      expect(() => inspectCard(card, NOW)).toThrow(CreditCardError)
      try {
        inspectCard(card, NOW)
      } catch (err) {
        expect((err as CreditCardError).code).toBe(expected.code)
        expect((err as CreditCardError).description).toBe(expected.description)
      }
    })
  }

  rejects({ number: '411111111111' }, CARD_ERRORS.INVALID_NUMBER, 'número curto demais')
  rejects({ number: '4111a111111111111' }, CARD_ERRORS.INVALID_NUMBER, 'número com letra')
  rejects(
    { number: '4111111111111111', expiryMonth: '13' },
    CARD_ERRORS.INVALID_MONTH,
    'mês fora de 1–12',
  )
  rejects(
    { number: '4111111111111111', expiryMonth: '05', expiryYear: '2020' },
    CARD_ERRORS.EXPIRED,
    'cartão expirado',
  )
  rejects({ number: '4111111111111111', ccv: '' }, CARD_ERRORS.MISSING_CVV, 'CVV vazio')
  rejects(
    { number: '4111111111111111', holderName: '' },
    CARD_ERRORS.MISSING_HOLDER,
    'titular vazio',
  )

  it('o mês de vencimento é INCLUSIVO — um cartão 07/2026 vale em 14/07/2026', () => {
    expect(isExpired(7, 2026, NOW)).toBe(false)
    expect(isExpired(6, 2026, NOW)).toBe(true)
  })
})

describe('cartões de simulação (extensão nossa, não existe no Asaas)', () => {
  it('cada cartão de simulação força o SEU erro, com a mensagem real do Asaas', () => {
    const cases: Array<[string, keyof typeof CARD_ERRORS]> = [
      ['4000000000000069', 'EXPIRED'],
      ['4000000000000101', 'INVALID_NUMBER'],
    ]

    for (const [number, outcome] of cases) {
      try {
        inspectCard({ number, expiryMonth: '12', expiryYear: '2035', ccv: '123' }, NOW)
        throw new Error(`${number} deveria ter recusado`)
      } catch (err) {
        expect(err).toBeInstanceOf(CreditCardError)
        expect((err as CreditCardError).code).toBe(CARD_ERRORS[outcome].code)
        expect((err as CreditCardError).description).toBe(CARD_ERRORS[outcome].description)
      }
    }
  })

  it('4000000000000002 recusa na AUTORIZAÇÃO (vira token, e o token recusa)', () => {
    expect(inspectCard({ number: '4000000000000002' }, NOW).outcome).toBe('DECLINE')
  })

  /**
   * A tabela do painel É a tabela do motor. Sem isto, a tela pode anunciar um
   * cartão que o servidor não honra — e a mentira sai bonita, com botão de copiar.
   */
  it('todo cartão da tabela faz o que a tabela promete', () => {
    for (const c of TEST_CARDS) {
      const isAuthOutcome =
        c.outcome === 'APPROVE' || c.outcome === 'DECLINE' || c.outcome === 'DECLINE_ON_CHARGE'

      if (isAuthOutcome) {
        // Sobrevive à validação e decide na hora de cobrar. O `isAuthOutcome` já
        // estreitou o valor; o TS não acompanha através da variável.
        expect(inspectCard({ number: c.number }, NOW).outcome).toBe(
          c.outcome as AuthorizationOutcome,
        )
      } else {
        // Recusa a requisição na porta.
        expect(() => inspectCard({ number: c.number }, NOW)).toThrow(CreditCardError)
      }
    }
  })

  /**
   * A diferença inteira entre os dois DECLINE: um nunca vira token (é o do Asaas
   * real), o outro vira e recusa depois (é o nosso, para o cenário que o sandbox
   * não sabe produzir). O erro entregue ao cliente é o mesmo nos dois.
   */
  it('DECLINE recusa ao salvar; DECLINE_ON_CHARGE só ao cobrar', () => {
    expect(declinesOnTokenize('DECLINE')).toBe(true)
    expect(declinesOnTokenize('DECLINE_ON_CHARGE')).toBe(false)

    expect(declinesOnCharge('DECLINE')).toBe(true)
    expect(declinesOnCharge('DECLINE_ON_CHARGE')).toBe(true)
    expect(declinesOnCharge('APPROVE')).toBe(false)

    expect(CARD_ERRORS.DECLINE_ON_CHARGE).toEqual(CARD_ERRORS.DECLINE)
  })
})

describe('parcelamento por bandeira', () => {
  it('Visa e Mastercard aceitam 21x; as demais, 12x', () => {
    expect(maxInstallmentsForBrand('VISA')).toBe(21)
    expect(maxInstallmentsForBrand('MASTERCARD')).toBe(21)
    expect(maxInstallmentsForBrand('DINERS')).toBe(12)
    expect(maxInstallmentsForBrand('ELO')).toBe(12)
    expect(maxInstallmentsForBrand('AMEX')).toBe(12)
  })
})
