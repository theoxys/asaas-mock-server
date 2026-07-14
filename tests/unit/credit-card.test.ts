/**
 * Luhn, bandeira e cartões de teste — puro, table-driven, sem subir nada.
 */
import { describe, expect, it } from 'bun:test'
import {
  BRAND_RULES,
  CreditCardError,
  detectBrand,
  inspectCard,
  luhn,
  normalizeCardNumber,
  outcomeFor,
  TEST_CARDS,
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
    const custom = { ...TEST_CARDS, '4111111111111111': 'DECLINE' as const }
    expect(outcomeFor('4111111111111111', custom)).toBe('DECLINE')
  })
})

describe('inspectCard', () => {
  it('devolve só os 4 últimos dígitos — nunca o número', () => {
    const info = inspectCard({
      number: '4444444444444444',
      holderName: 'John Doe',
      expiryMonth: '12',
      expiryYear: '2030',
      ccv: '123',
    })

    expect(info).toEqual({ last4: '4444', brand: 'VISA', outcome: 'APPROVE' })
    // O PAN não sobrevive: não existe campo nenhum com 16 dígitos no resultado.
    expect(JSON.stringify(info)).not.toContain('4444444444444444')
  })

  it('o cartão de teste é válido POR DECRETO — a tabela vem antes do Luhn', () => {
    // 4444444444444444 falha no Luhn e ainda assim é aceito.
    expect(luhn('4444444444444444')).toBe(false)
    expect(inspectCard({ number: '4444444444444444' }).outcome).toBe('APPROVE')
  })

  it('um cartão válido qualquer aprova', () => {
    expect(inspectCard({ number: '4111111111111111' }).outcome).toBe('APPROVE')
  })

  it('o cartão de recusa devolve DECLINE (mas é um cartão válido)', () => {
    const info = inspectCard({ number: '5184019740373151' })
    expect(info).toEqual({ last4: '3151', brand: 'MASTERCARD', outcome: 'DECLINE' })
  })

  const rejects = (card: Parameters<typeof inspectCard>[0], why: string) => {
    it(why, () => {
      expect(() => inspectCard(card)).toThrow(CreditCardError)
      try {
        inspectCard(card)
      } catch (err) {
        expect((err as CreditCardError).code).toBe('invalid_creditCard')
      }
    })
  }

  rejects({ number: '5184019740373152' }, 'número que falha no Luhn → invalid_creditCard')
  rejects({ number: '411111111111' }, 'número curto demais → invalid_creditCard')
  rejects({ number: '4111a111111111111' }, 'número com letra → invalid_creditCard')
  rejects(
    { number: '4111111111111111', expiryMonth: '13' },
    'mês de expiração fora de 1–12 → invalid_creditCard',
  )
  rejects(
    { number: '4111111111111111', expiryYear: '26' },
    'ano de expiração com 2 dígitos → invalid_creditCard',
  )
  rejects(
    { number: '4111111111111111', ccv: '12' },
    'código de segurança com 2 dígitos → invalid_creditCard',
  )
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
