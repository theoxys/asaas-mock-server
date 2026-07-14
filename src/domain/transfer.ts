/**
 * Transferências. PURO.
 *
 * Duas regras, e as duas são as que quebram integração quando erradas:
 *
 *   PIX  → cai no MESMO DIA (a rede Pix é 24×7; não há dia útil aqui).
 *   TED  → cai no PRÓXIMO DIA ÚTIL. Pedir uma TED na sexta credita na segunda.
 *
 * A transferência INTERNA (entre duas contas Asaas) é instantânea e gratuita —
 * não sai da plataforma, então não tem TED nem Pix no meio.
 */
import { addBusinessDays, type IsoDate } from './calendar.ts'
import type { FeeTable } from '../core/config.ts'
import { cents, type Cents } from './money.ts'

/** O que a coluna `operation_type` guarda. */
export type TransferOperationType = 'PIX' | 'TED' | 'INTERNAL'
/** O que a coluna `type` guarda. Não é a mesma coisa — veja o serializer. */
export type TransferKind = 'BANK_ACCOUNT' | 'PIX' | 'INTERNAL'

/**
 * A taxa da transferência.
 *
 * TODO(regra): `config.fees.transfer.monthlyWithoutFee` (30 transferências
 * gratuitas por mês) NÃO é aplicado. O Asaas não documenta o que conta para a
 * franquia (Pix e TED juntos? por conta ou por subconta? o mês é o de
 * competência ou os últimos 30 dias?), e inventar uma resposta faria a taxa
 * aparecer ou sumir do extrato de forma que ninguém consegue conferir.
 */
export function transferFee(fees: FeeTable, operationType: TransferOperationType): Cents {
  switch (operationType) {
    case 'PIX':
      return fees.transfer.pix
    case 'TED':
      return fees.transfer.ted
    case 'INTERNAL':
      return cents(0)
  }
}

/**
 * Quando o dinheiro chega na conta de destino, dado o dia em que o banco
 * começou a processar.
 */
export function transferEffectiveDate(
  operationType: TransferOperationType,
  processingOn: IsoDate,
): IsoDate {
  return operationType === 'TED' ? addBusinessDays(processingOn, 1) : processingOn
}
