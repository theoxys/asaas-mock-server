/**
 * Os cálculos financeiros. É onde moram 90% dos bugs reais de um gateway.
 *
 * Tudo aqui é table-driven e vale como GOLDEN TEST: cada linha é um número que
 * afirmamos ser o do Asaas. Quando a suíte de paridade rodar contra o sandbox
 * real e encontrar uma divergência, a correção entra como uma linha nova aqui.
 */
import { describe, expect, it } from 'bun:test'
import { loadConfig } from '../../src/core/config.ts'
import {
  addBusinessDays,
  addMonths,
  advanceCycle,
  daysBetween,
  isBusinessDay,
  nextBusinessDay,
} from '../../src/domain/calendar.ts'
import { calcFee, netValue } from '../../src/domain/fees.ts'
import { installmentDueDates, splitTotal } from '../../src/domain/installments.ts'
import { calcDiscount, calcFine, calcInterest, calcOverdueTotals } from '../../src/domain/interest.ts'
import { cents, percentE4 } from '../../src/domain/money.ts'
import { computeSplits, distributeTotalFixedValue } from '../../src/domain/split.ts'
import { creditDateFor, skipsConfirmed } from '../../src/domain/settlement.ts'

const fees = loadConfig().fees
const rules = { creditCardSettlementDays: 32, debitCardSettlementDays: 3 }

describe('taxas', () => {
  it('boleto: R$ 1,99 fixo, independente do valor', () => {
    expect(calcFee(fees, 'BOLETO', cents(10_000))).toBe(199 as never)
    expect(calcFee(fees, 'BOLETO', cents(1_000_000))).toBe(199 as never)
  })

  it('Pix: R$ 1,99 FIXO — não é percentual', () => {
    // É contraintuitivo e as pessoas erram: o Pix do Asaas não cobra %.
    expect(calcFee(fees, 'PIX', cents(10_000))).toBe(199 as never)
    expect(calcFee(fees, 'PIX', cents(1_000_000))).toBe(199 as never)
  })

  it('cartão à vista: R$ 0,49 + 2,99%', () => {
    // R$ 100,00 → 49 + 299 = R$ 3,48
    expect(calcFee(fees, 'CREDIT_CARD', cents(10_000), 1)).toBe(348 as never)
  })

  it('cartão: a faixa percentual muda com o número de parcelas', () => {
    const v = cents(10_000) // R$ 100,00
    expect(calcFee(fees, 'CREDIT_CARD', v, 1)).toBe(348 as never) // 0,49 + 2,99%
    expect(calcFee(fees, 'CREDIT_CARD', v, 6)).toBe(398 as never) // 0,49 + 3,49%
    expect(calcFee(fees, 'CREDIT_CARD', v, 12)).toBe(448 as never) // 0,49 + 3,99%
    expect(calcFee(fees, 'CREDIT_CARD', v, 18)).toBe(478 as never) // 0,49 + 4,29%
  })

  it('UNDEFINED não tem taxa: o meio de pagamento ainda não foi escolhido', () => {
    expect(calcFee(fees, 'UNDEFINED', cents(10_000))).toBe(0 as never)
  })

  it('netValue = value − taxa', () => {
    // Pix de R$ 100,00, taxa R$ 1,99 → líquido R$ 98,01
    expect(netValue(cents(10_000), calcFee(fees, 'PIX', cents(10_000)))).toBe(9801 as never)
  })
})

describe('multa e juros', () => {
  const fine = { value: 2, type: 'PERCENTAGE' as const } // 2%
  const interest = { value: 1 } // 1% ao mês

  it('multa percentual é aplicada uma vez', () => {
    expect(calcFine(fine, cents(10_000))).toBe(200 as never) // 2% de R$100
  })

  it('multa fixa é o valor em reais', () => {
    expect(calcFine({ value: 5, type: 'FIXED' }, cents(10_000))).toBe(500 as never)
  })

  it('juros são pro-rata die sobre mês comercial de 30 dias', () => {
    // R$ 100,00 × 1% / 30 × 30 dias = R$ 1,00
    expect(calcInterest(interest, cents(10_000), 30)).toBe(100 as never)
    // 15 dias = metade
    expect(calcInterest(interest, cents(10_000), 15)).toBe(50 as never)
    // 1 dia = 1/30 de 1% de 100 = R$ 0,0333 → R$ 0,03
    expect(calcInterest(interest, cents(10_000), 1)).toBe(3 as never)
  })

  it('sem atraso não há juros nem multa', () => {
    expect(calcInterest(interest, cents(10_000), 0)).toBe(0 as never)
  })

  it('cobrança vencida há 10 dias: valor = original + multa + juros', () => {
    const totals = calcOverdueTotals(
      {
        originalValueCents: cents(10_000),
        dueDate: '2026-01-05',
        fine,
        interest,
      },
      '2026-01-15', // 10 dias depois
    )

    expect(totals.daysLate).toBe(10)
    expect(totals.fine).toBe(200 as never) // 2% aplicado UMA vez
    expect(totals.interest).toBe(33 as never) // 100 × 1% / 30 × 10 = 0,333…
    expect(totals.interestValue).toBe(233 as never) // multa + juros
    expect(totals.value).toBe(10_233 as never) // R$ 102,33
    expect(totals.originalValue).toBe(10_000 as never)
  })

  it('os juros crescem um dia por vez', () => {
    const at = (on: string) =>
      calcOverdueTotals(
        { originalValueCents: cents(10_000), dueDate: '2026-01-05', fine: null, interest },
        on,
      ).value

    expect(at('2026-01-05')).toBe(10_000 as never) // no dia: sem juros
    expect(at('2026-01-06')).toBe(10_003 as never)
    expect(at('2026-01-07')).toBe(10_007 as never)
    expect(at('2026-02-04')).toBe(10_100 as never) // 30 dias → 1% cheio
  })
})

describe('desconto', () => {
  const discount = { value: 10, dueDateLimitDays: 0, type: 'PERCENTAGE' as const }

  it('vale até o dia do vencimento', () => {
    expect(calcDiscount(discount, cents(10_000), '2026-01-10', '2026-01-05')).toBe(1000 as never)
    expect(calcDiscount(discount, cents(10_000), '2026-01-10', '2026-01-10')).toBe(1000 as never)
  })

  it('não vale depois do vencimento', () => {
    expect(calcDiscount(discount, cents(10_000), '2026-01-10', '2026-01-11')).toBe(0 as never)
  })

  it('dueDateLimitDays encurta a janela', () => {
    // Vale só até 5 dias ANTES do vencimento.
    const d = { value: 10, dueDateLimitDays: 5, type: 'PERCENTAGE' as const }
    expect(calcDiscount(d, cents(10_000), '2026-01-10', '2026-01-05')).toBe(1000 as never) // 5 dias antes: vale
    expect(calcDiscount(d, cents(10_000), '2026-01-10', '2026-01-06')).toBe(0 as never) // 4 dias antes: não
  })

  it('desconto fixo', () => {
    const d = { value: 7.5, dueDateLimitDays: 0, type: 'FIXED' as const }
    expect(calcDiscount(d, cents(10_000), '2026-01-10', '2026-01-05')).toBe(750 as never)
  })
})

describe('divisão de parcelas — a sobra vai na ÚLTIMA', () => {
  it('R$ 350 em 12x → 11 × R$ 29,16 + R$ 29,24  (o exemplo oficial do Asaas)', () => {
    const parts = splitTotal(cents(35_000), 12)

    expect(parts.length).toBe(12)
    expect(parts.slice(0, 11)).toEqual(Array(11).fill(2916))
    expect(parts[11]).toBe(2924 as never)
  })

  it('a soma das parcelas é SEMPRE exatamente o total', () => {
    for (const total of [35_000, 10_000, 9999, 1, 100_003, 777]) {
      for (const n of [1, 2, 3, 7, 12, 21]) {
        const parts = splitTotal(cents(total), n)
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      }
    }
  })

  it('divisão exata não gera sobra', () => {
    expect(splitTotal(cents(30_000), 3)).toEqual([10_000, 10_000, 10_000] as never)
  })

  it('vencimentos são mensais a partir da primeira parcela', () => {
    expect(installmentDueDates('2026-01-15', 3)).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ])
  })

  it('dia 31 não escorrega pelo calendário: cai no último dia do mês', () => {
    // Sem isso, quem assina dia 31 de janeiro veria a cobrança de fevereiro
    // cair em 3 de março.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(installmentDueDates('2026-01-31', 3)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ])
  })
})

describe('split — incide sobre o netValue, não sobre o bruto', () => {
  it('30% de uma cobrança Pix de R$ 100 é R$ 29,40, não R$ 30,00', () => {
    // A taxa (R$ 1,99) sai primeiro. O split reparte o que sobrou.
    const value = cents(10_000)
    const fee = calcFee(fees, 'PIX', value) // 199
    const net = netValue(value, fee) // 9801

    const result = computeSplits(net, [
      { walletId: 'w1', percentualValueE4: percentE4(300_000) }, // 30%
    ])

    expect(result.splits[0]!.totalValueCents).toBe(2940 as never) // 30% de 98,01
    expect(result.divergent).toBe(false)
    expect(result.remainderCents).toBe(6861 as never) // sobra para o lojista
  })

  it('fixo e percentual coexistem e simplesmente somam', () => {
    const result = computeSplits(cents(10_000), [
      { walletId: 'w1', fixedValueCents: cents(2000) },
      { walletId: 'w2', percentualValueE4: percentE4(100_000) }, // 10%
    ])
    expect(result.totalCents).toBe(3000 as never) // R$ 20 + R$ 10
  })

  it('soma acima do netValue é DIVERGÊNCIA (o Asaas bloqueia)', () => {
    const result = computeSplits(cents(10_000), [
      { walletId: 'w1', fixedValueCents: cents(6000) },
      { walletId: 'w2', fixedValueCents: cents(5000) },
    ])
    expect(result.divergent).toBe(true)
  })

  it('percentual com 4 casas decimais é preservado', () => {
    const result = computeSplits(cents(10_000), [
      { walletId: 'w1', percentualValueE4: percentE4(923_444) }, // 92,3444%
    ])
    expect(result.splits[0]!.totalValueCents).toBe(9234 as never)
  })

  it('totalFixedValue divide entre as parcelas, com a sobra na última', () => {
    // R$ 100 em 3 parcelas → 33,33 | 33,33 | 33,34
    expect(distributeTotalFixedValue(cents(10_000), 3)).toEqual([3333, 3333, 3334] as never)
  })
})

describe('liquidação — quando o dinheiro vira saldo', () => {
  it('Pix pula CONFIRMED e credita na hora', () => {
    expect(skipsConfirmed('PIX')).toBe(true)
    expect(creditDateFor('PIX', '2026-01-05', rules)).toBe('2026-01-05')
  })

  it('boleto, cartão e débito passam por CONFIRMED', () => {
    expect(skipsConfirmed('BOLETO')).toBe(false)
    expect(skipsConfirmed('CREDIT_CARD')).toBe(false)
    expect(skipsConfirmed('DEBIT_CARD')).toBe(false)
  })

  it('boleto credita no próximo dia útil', () => {
    // Segunda 05/01 → terça 06/01
    expect(creditDateFor('BOLETO', '2026-01-05', rules)).toBe('2026-01-06')
    // Sexta 09/01 → segunda 12/01 (pula o fim de semana)
    expect(creditDateFor('BOLETO', '2026-01-09', rules)).toBe('2026-01-12')
  })

  it('cartão de crédito credita em D+32', () => {
    expect(creditDateFor('CREDIT_CARD', '2026-01-05', rules)).toBe('2026-02-06')
  })

  it('cartão de débito credita em D+3', () => {
    expect(creditDateFor('DEBIT_CARD', '2026-01-05', rules)).toBe('2026-01-08')
  })
})

describe('calendário', () => {
  it('reconhece fim de semana', () => {
    expect(isBusinessDay('2026-01-10')).toBe(false) // sábado
    expect(isBusinessDay('2026-01-11')).toBe(false) // domingo
    expect(isBusinessDay('2026-01-12')).toBe(true) // segunda
  })

  it('reconhece feriados fixos', () => {
    expect(isBusinessDay('2026-01-01')).toBe(false) // Confraternização
    expect(isBusinessDay('2026-12-25')).toBe(false) // Natal
    expect(isBusinessDay('2026-09-07')).toBe(false) // Independência
  })

  it('reconhece feriados móveis (dependem da Páscoa)', () => {
    // Páscoa 2026: 05/04. Sexta-feira Santa: 03/04. Carnaval: 16 e 17/02.
    expect(isBusinessDay('2026-04-03')).toBe(false)
    expect(isBusinessDay('2026-02-16')).toBe(false)
    expect(isBusinessDay('2026-02-17')).toBe(false)
    expect(isBusinessDay('2026-06-04')).toBe(false) // Corpus Christi
  })

  it('nextBusinessDay devolve a própria data se já for dia útil', () => {
    expect(nextBusinessDay('2026-01-05')).toBe('2026-01-05')
    expect(nextBusinessDay('2026-01-10')).toBe('2026-01-12') // sábado → segunda
  })

  it('addBusinessDays pula fim de semana e feriado', () => {
    expect(addBusinessDays('2026-01-09', 1)).toBe('2026-01-12') // sexta +1 útil = segunda
    expect(addBusinessDays('2026-12-24', 1)).toBe('2026-12-28') // pula Natal e o fim de semana
  })

  it('daysBetween conta dias inteiros', () => {
    expect(daysBetween('2026-01-15', '2026-01-05')).toBe(10)
    expect(daysBetween('2026-01-05', '2026-01-05')).toBe(0)
  })

  it('ciclos de assinatura', () => {
    expect(advanceCycle('2026-01-15', 'WEEKLY')).toBe('2026-01-22')
    expect(advanceCycle('2026-01-15', 'BIWEEKLY')).toBe('2026-01-29')
    expect(advanceCycle('2026-01-15', 'MONTHLY')).toBe('2026-02-15')
    expect(advanceCycle('2026-01-15', 'BIMONTHLY')).toBe('2026-03-15')
    expect(advanceCycle('2026-01-15', 'QUARTERLY')).toBe('2026-04-15')
    expect(advanceCycle('2026-01-15', 'SEMIANNUALLY')).toBe('2026-07-15')
    expect(advanceCycle('2026-01-15', 'YEARLY')).toBe('2027-01-15')
  })
})
