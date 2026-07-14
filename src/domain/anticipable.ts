/**
 * `payment.anticipable` — a cobrança pode ser antecipada? PURO.
 *
 * A regra foi DEDUZIDA de 11 pontos de dados capturados do sandbox real, e é
 * mais sutil do que parece:
 *
 *   anticipable = o meio de pagamento é antecipável
 *              E o valor cabe no LIMITE DISPONÍVEL de antecipação da conta
 *              E o vencimento está dentro de 90 dias
 *
 * O que nos enganou no caminho: um boleto AVULSO de R$ 350 vencendo em 10 dias
 * vinha `false`, enquanto a parcela de R$ 29,16 de um parcelamento vencendo no
 * mesmo prazo vinha `true`. Parecia que só parcelamento era antecipável. Não é —
 * a conta de teste tinha um limite de antecipação de boleto de **R$ 66,66**, e o
 * boleto de R$ 350 simplesmente não cabia. Os R$ 29,16 cabiam.
 *
 * Os 11 casos, todos reproduzidos por esta função:
 *
 *   R$  29,16  D+10   → true      R$ 100,00  D+80   → false  (valor > limite)
 *   R$  29,16  D+41   → true      R$  50,00  D+73   → true
 *   R$  29,16  D+72   → true      R$  50,00  D+85   → true
 *   R$  29,16  D+102  → false     R$ 350,00  D+10   → false  (valor > limite)
 *   R$  29,24  D+345  → false     R$ 500,00  D+60   → false  (valor > limite)
 *
 * ⚠️  O LIMITE NÃO É REPRODUZÍVEL. Ele sai da análise de crédito do Asaas e é
 * específico da conta (`GET /v3/anticipations/limits`). Nenhum simulador pode
 * adivinhá-lo. Por isso ele é CONFIGURÁVEL aqui, e `anticipable` fica de fora da
 * comparação de paridade — comparar um número que depende do risco de crédito do
 * cliente seria comparar ruído.
 */
import { addDays, type IsoDate } from './calendar.ts'
import type { BillingType } from './fees.ts'
import type { Cents } from './money.ts'

/** Só boleto e cartão são antecipáveis. Pix não — não há recebível futuro. */
export function isAnticipatableBillingType(billingType: BillingType): boolean {
  return billingType === 'BOLETO' || billingType === 'CREDIT_CARD'
}

export interface AnticipableInput {
  billingType: BillingType
  status: string
  valueCents: Cents
  dueDate: IsoDate
  today: IsoDate
  /** `GET /v3/anticipations/limits` → `available` do meio correspondente. */
  availableLimitCents: Cents
  /** 90 no Asaas real. Configurável porque é um número deles, não nosso. */
  horizonDays: number
}

export function isAnticipable(i: AnticipableInput): boolean {
  if (!isAnticipatableBillingType(i.billingType)) return false

  // Cobrança já paga, estornada ou removida não tem recebível a antecipar.
  if (i.status !== 'PENDING' && i.status !== 'OVERDUE' && i.status !== 'CONFIRMED') return false

  if (i.valueCents > i.availableLimitCents) return false

  return i.dueDate <= addDays(i.today, i.horizonDays)
}
