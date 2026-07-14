/**
 * Serialização de transferência. A fronteira onde centavos viram reais.
 *
 * PEGADINHA DA SPEC: o campo `type` da RESPOSTA é `PIX | TED | INTERNAL` — é o
 * tipo da OPERAÇÃO, não o do destino. A coluna `transfers.type` guarda
 * `BANK_ACCOUNT | PIX | INTERNAL` (o destino). Serializar a coluna direto
 * devolveria "BANK_ACCOUNT", que não está no enum da spec e quebraria o contrato.
 */
import type { transfers } from '../../db/schema/index.ts'
import { cents, centsToBrl } from '../../domain/money.ts'

export type TransferRow = typeof transfers.$inferSelect

const money = (v: number | null): number | null => (v === null ? null : centsToBrl(cents(v)))

export function serializeTransfer(t: TransferRow): Record<string, unknown> {
  const internal = t.operationType === 'INTERNAL'

  return {
    object: 'transfer',
    id: t.id,
    type: t.operationType, // PIX | TED | INTERNAL — veja o comentário do topo
    operationType: t.operationType,
    dateCreated: t.dateCreated,

    value: money(t.valueCents),
    netValue: money(t.netValueCents),
    transferFee: money(t.transferFeeCents),

    status: t.status,
    effectiveDate: t.effectiveDate,
    scheduleDate: t.scheduleDate,
    endToEndIdentifier: t.endToEndIdentifier,
    authorized: t.authorized,
    failReason: t.failReason,
    externalReference: t.externalReference,
    transactionReceiptUrl: t.transactionReceiptUrl,
    description: t.description,
    recurring: null,

    // Transferência interna devolve `walletId` + `account`; a externa,
    // `bankAccount`. Os dois schemas da spec são todo-opcional, então mandar o
    // campo do outro lado como null é seguro — e é o que o Asaas faz.
    walletId: internal ? t.destinationWalletId : null,
    bankAccount: internal ? null : serializeBankAccount(t),
  }
}

function serializeBankAccount(t: TransferRow): Record<string, unknown> | null {
  const b = t.bankAccount
  if (!b && !t.pixAddressKey) return null

  return {
    bank: b?.bank
      ? { ispb: b.bank.ispb ?? null, code: b.bank.code ?? null, name: b.bank.name ?? null }
      : null,
    accountName: b?.accountName ?? null,
    ownerName: b?.ownerName ?? null,
    cpfCnpj: b?.cpfCnpj ?? null,
    agency: b?.agency ?? null,
    agencyDigit: b?.agencyDigit ?? null,
    account: b?.account ?? null,
    accountDigit: b?.accountDigit ?? null,
    pixAddressKey: t.pixAddressKey,
  }
}

/**
 * A resposta da transferência interna acrescenta os dados básicos da conta de
 * destino. `name`/`cpfCnpj` vêm da conta resolvida pelo walletId.
 */
export function serializeInternalTransfer(
  t: TransferRow,
  destination: { name: string; cpfCnpj: string; accountNumber: string | null },
): Record<string, unknown> {
  return {
    ...serializeTransfer(t),
    account: {
      name: destination.name,
      cpfCnpj: destination.cpfCnpj,
      agency: '0001',
      account: destination.accountNumber,
      accountDigit: null,
    },
  }
}
