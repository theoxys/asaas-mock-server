/**
 * O simulador de vendas, e a REGRA DE TRUNCAMENTO da taxa parcelada.
 *
 * Todos os números aqui foram capturados de `POST /v3/payments/simulate` e de
 * `POST /v3/payments` contra o sandbox REAL do Asaas em 2026-07-14. Não são
 * deduzidos da documentação — são o que a API devolveu.
 *
 * O caso de 350 em 12x é o que existe para travar a regra: a taxa total dá
 * 1446 centavos, 1446/12 = 120,5 — arredondando dá 121, truncando dá 120. O
 * Asaas devolve 120. Enquanto usávamos Math.round, errávamos UM CENTAVO POR
 * PARCELA, e nenhum outro caso da suíte separava as duas regras.
 */
import { describe, expect, it } from 'bun:test'
import { loadConfig } from '../../src/core/config.ts'
import { calcInstallmentFee } from '../../src/domain/fees.ts'
import { brlToCents, cents } from '../../src/domain/money.ts'
import { simulate } from '../../src/domain/simulator.ts'

const fees = loadConfig().fees
const brl = (c: number) => c / 100

describe('taxa da parcela no cartão — TRUNCA, não arredonda', () => {
  it('R$ 350 em 12x → R$ 1,20 por parcela (não 1,21)', () => {
    // sandbox: value 29.16, netValue 27.96 → taxa 1,20
    expect(calcInstallmentFee(fees, 'CREDIT_CARD', brlToCents(350), 12)).toBe(cents(120))
  })

  it('R$ 300 em 3x → R$ 3,65 por parcela', () => {
    // sandbox: value 100.00, netValue 96.35 → taxa 3,65
    expect(calcInstallmentFee(fees, 'CREDIT_CARD', brlToCents(300), 3)).toBe(cents(365))
  })

  it('no boleto a taxa é por parcela emitida, e não se divide', () => {
    expect(calcInstallmentFee(fees, 'BOLETO', brlToCents(350), 12)).toBe(cents(199))
  })
})

describe('POST /v3/payments/simulate', () => {
  it('à vista: Pix R$ 100 → líquido R$ 98,01', () => {
    const s = simulate(fees, { valueCents: brlToCents(100), billingTypes: ['PIX'] })

    expect(brl(s.pix!.netValueCents)).toBe(98.01)
    expect(brl(s.pix!.feeFixedCents)).toBe(1.99)
    expect(s.pix!.installment).toBeNull()

    // As chaves não pedidas SAEM, e saem nulas — um cliente pode ler `.creditCard`.
    expect(s.creditCard).toBeNull()
    expect(s.bankSlip).toBeNull()
  })

  it('à vista: cartão R$ 100 → líquido R$ 96,52, a 2,99%', () => {
    const s = simulate(fees, {
      valueCents: brlToCents(100),
      billingTypes: ['CREDIT_CARD'],
      installmentCount: 1,
    })

    expect(brl(s.creditCard!.netValueCents)).toBe(96.52)
    expect(s.creditCard!.feeBp! / 100).toBe(2.99)
    expect(brl(s.creditCard!.feeFixedCents)).toBe(0.49)
    expect(s.creditCard!.installment).toBeNull()
  })

  it('R$ 100 em 3x: parcelar no BOLETO custa mais caro que no CARTÃO', () => {
    const s = simulate(fees, {
      valueCents: brlToCents(100),
      billingTypes: ['CREDIT_CARD', 'BOLETO', 'PIX'],
      installmentCount: 3,
    })

    // Cartão: taxa 0,49 + 3,49% = 3,98, dividida por 3 → 1,32 (trunca) por parcela.
    expect(brl(s.creditCard!.netValueCents)).toBe(96.04)
    expect(s.creditCard!.feeBp! / 100).toBe(3.49)
    expect(brl(s.creditCard!.installment!.paymentValueCents)).toBe(33.33)
    expect(brl(s.creditCard!.installment!.paymentNetValueCents)).toBe(32.01)

    // Boleto: R$ 1,99 POR PARCELA — 3 boletos, 3 taxas. Não se divide.
    expect(brl(s.bankSlip!.netValueCents)).toBe(94.03)
    expect(brl(s.bankSlip!.installment!.paymentNetValueCents)).toBe(31.34)

    expect(brl(s.pix!.netValueCents)).toBe(94.03)

    // É contraintuitivo e é real: o boleto parcelado sai R$ 2,01 mais caro.
    expect(s.bankSlip!.netValueCents).toBeLessThan(s.creditCard!.netValueCents)
  })

  it('R$ 350 em 12x no cartão → líquido R$ 335,60, parcela 29,16 / 27,96', () => {
    const s = simulate(fees, {
      valueCents: brlToCents(350),
      billingTypes: ['CREDIT_CARD'],
      installmentCount: 12,
    })

    expect(brl(s.creditCard!.netValueCents)).toBe(335.6)
    expect(s.creditCard!.feeBp! / 100).toBe(3.99)
    expect(brl(s.creditCard!.installment!.paymentValueCents)).toBe(29.16)
    expect(brl(s.creditCard!.installment!.paymentNetValueCents)).toBe(27.96)
  })
})
