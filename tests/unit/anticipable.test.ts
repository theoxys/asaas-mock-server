/**
 * Os 11 pontos de dados capturados do sandbox REAL do Asaas.
 *
 * Não são casos inventados: cada linha foi lida de uma resposta da API de
 * verdade, e a regra foi deduzida delas. Se alguém "simplificar" a regra, este
 * arquivo é quem avisa.
 */
import { describe, expect, it } from 'bun:test'
import { isAnticipable } from '../../src/domain/anticipable.ts'
import { addDays } from '../../src/domain/calendar.ts'
import { brlToCents } from '../../src/domain/money.ts'

const HOJE = '2026-07-14' // o dia em que a captura rodou
const LIMITE = brlToCents(66.66) // o limite REAL da conta de sandbox usada

const anticipable = (valor: number, emDias: number, billingType = 'BOLETO') =>
  isAnticipable({
    billingType: billingType as never,
    status: 'PENDING',
    valueCents: brlToCents(valor),
    dueDate: addDays(HOJE, emDias),
    today: HOJE,
    availableLimitCents: LIMITE,
    horizonDays: 90,
  })

describe('anticipable — capturado do Asaas real', () => {
  it.each([
    // valor,  vence em,  esperado,  por quê
    [29.16, 10, true, 'cabe no limite, dentro do horizonte'],
    [29.16, 41, true, 'cabe no limite, dentro do horizonte'],
    [29.16, 72, true, 'cabe no limite, dentro do horizonte'],
    [29.16, 102, false, 'passou dos 90 dias'],
    [29.24, 345, false, 'muito além do horizonte'],
    [50.0, 73, true, 'cabe no limite'],
    [50.0, 79, true, 'cabe no limite'],
    [50.0, 85, true, 'ainda dentro dos 90 dias'],
    [100.0, 80, false, 'R$ 100 NÃO cabe no limite de R$ 66,66'],
    [350.0, 10, false, 'valor muito acima do limite'],
    [500.0, 60, false, 'valor muito acima do limite'],
  ])('R$ %s vencendo em D+%s → %s (%s)', (valor, dias, esperado) => {
    expect(anticipable(valor as number, dias as number)).toBe(esperado as boolean)
  })

  it('Pix nunca é antecipável — não existe recebível futuro', () => {
    expect(anticipable(10, 5, 'PIX')).toBe(false)
  })

  it('o corte do horizonte é EXATAMENTE 90 dias', () => {
    expect(anticipable(10, 90)).toBe(true)
    expect(anticipable(10, 91)).toBe(false)
  })

  it('o corte do limite é EXATAMENTE o valor disponível', () => {
    expect(anticipable(66.66, 10)).toBe(true)
    expect(anticipable(66.67, 10)).toBe(false)
  })
})
