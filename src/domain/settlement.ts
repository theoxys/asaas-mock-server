/**
 * Quando o dinheiro vira saldo. PURO.
 *
 * É a divergência mais importante entre meios de pagamento, e ela vive AQUI, num
 * lugar só — para que nenhum handler precise lembrar dela:
 *
 *   PIX          → RECEIVED na hora. PULA o estado CONFIRMED. Crédito imediato.
 *   BOLETO       → CONFIRMED → RECEIVED no próximo dia útil (D+1 útil).
 *   CREDIT_CARD  → CONFIRMED → RECEIVED em D+32 (dias corridos).
 *   DEBIT_CARD   → CONFIRMED → RECEIVED em D+3.
 *
 * O D+32 do cartão é o número da documentação técnica. O marketing do Asaas diz
 * "30 dias" — a doc técnica diz 32, e é a que vale. Está em config, ajustável.
 */
import { addBusinessDays, addDays, nextBusinessDay, type IsoDate } from './calendar.ts'
import type { BillingType } from './fees.ts'

export interface SettlementRules {
  creditCardSettlementDays: number // 32
  debitCardSettlementDays: number // 3
}

/**
 * O Pix não passa por CONFIRMED: vai direto de PENDING/OVERDUE para RECEIVED.
 * Todo o resto passa.
 */
export function skipsConfirmed(billingType: BillingType): boolean {
  return billingType === 'PIX'
}

/**
 * A data em que o crédito fica disponível, dado o dia da confirmação.
 *
 * Para o boleto, "próximo dia útil" — se o pagamento cai numa sexta, credita na
 * segunda. O Asaas não publica o cutoff de horário, então não modelamos um:
 * confirmou hoje, credita no próximo dia útil.
 */
export function creditDateFor(
  billingType: BillingType,
  confirmedOn: IsoDate,
  rules: SettlementRules,
  /**
   * O número da parcela (1 = primeira, ou cobrança à vista).
   *
   * PROVADO contra o sandbox real: num parcelamento no cartão, a emissora
   * autoriza tudo de uma vez (todas as parcelas confirmam no mesmo dia), mas o
   * dinheiro cai ESCALONADO — a parcela `n` credita em **D+32×n** a partir da
   * confirmação, rolado para o próximo dia útil.
   *
   *   confirmado em 14/07/2026, 6x:
   *   #1 +32d  = 15/08 (sáb) → 17/08     #4 +128d = 19/11
   *   #2 +64d  = 16/09                   #5 +160d = 21/12
   *   #3 +96d  = 18/10 (dom) → 19/10     #6 +192d = 22/01/2027
   *
   * As 6 datas batem na unha. A leitura intuitiva — "D+32 do vencimento de cada
   * parcela" — está errada e daria números diferentes.
   */
  installmentNumber = 1,
): IsoDate {
  switch (billingType) {
    case 'PIX':
      return confirmedOn // imediato

    case 'BOLETO':
      return addBusinessDays(confirmedOn, 1)

    case 'CREDIT_CARD':
      return nextBusinessDay(
        addDays(confirmedOn, rules.creditCardSettlementDays * Math.max(1, installmentNumber)),
      )

    case 'DEBIT_CARD':
      return addDays(confirmedOn, rules.debitCardSettlementDays)

    default:
      return confirmedOn
  }
}

/**
 * `estimatedCreditDate`.
 *
 * PROVADO contra o sandbox real: **é `null` enquanto a cobrança está PENDING.**
 * O Asaas não promete data de crédito para dinheiro que ainda não entrou — ele
 * só preenche este campo quando a cobrança confirma, e aí com o MESMO valor de
 * `creditDate`. Nós preenchíamos na criação (a partir do vencimento), o que
 * inventava uma data que a API real não dá.
 *
 * Fica aqui, devolvendo `null`, em vez de sumir: o campo existe no contrato, e
 * um leitor que procurar "onde calculamos estimatedCreditDate" precisa achar
 * esta explicação, não um silêncio.
 */
export function estimatedCreditDateFor(): null {
  return null
}
