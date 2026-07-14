/**
 * O ledger. Append-only, com saldo corrente.
 *
 * INVARIANTE, verificado nos testes a cada cenário:
 *   accounts.balanceCents === SUM(financial_transactions.valueCents) por conta.
 *
 * Por isso `postEntries` é o ÚNICO caminho para mexer em saldo — ele grava o
 * lançamento e atualiza o saldo materializado na mesma transação. Nunca faça
 * `UPDATE accounts SET balance_cents = …` em outro lugar.
 */
import { eq, sql } from 'drizzle-orm'
import type { DB } from '../db/client.ts'
import { accounts, financialTransactions } from '../db/schema/index.ts'
import type { Cents } from '../domain/money.ts'
import type { Clock } from './clock.ts'
import type { Rng } from './rng.ts'

/** Tipos de lançamento do extrato do Asaas usados pelo motor. */
export type FinancialTransactionType =
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FEE'
  | 'PAYMENT_REVERSAL'
  | 'PAYMENT_FEE_REVERSAL'
  | 'PAYMENT_REFUND_CANCELLED'
  | 'TRANSFER'
  | 'TRANSFER_FEE'
  | 'TRANSFER_REVERSAL'
  | 'INTERNAL_TRANSFER_CREDIT'
  | 'INTERNAL_TRANSFER_DEBIT'
  | 'INTERNAL_TRANSFER_REVERSAL'
  | 'RECEIVABLE_ANTICIPATION_GROSS_CREDIT'
  | 'RECEIVABLE_ANTICIPATION_FEE'
  | 'RECEIVABLE_ANTICIPATION_DEBIT'
  | 'PAYMENT_SPLIT_DIVERGENCE_BLOCK'
  | 'PAYMENT_SPLIT_DIVERGENCE_BLOCK_REVERSAL'
  | 'CHARGEBACK'
  | 'CHARGEBACK_REVERSAL'
  | 'BILL_PAYMENT'
  | 'BILL_PAYMENT_FEE'
  | 'INVOICE_FEE'
  | 'CREDIT'
  | 'DEBIT'

export interface LedgerEntry {
  accountId: string
  type: FinancialTransactionType
  /** ASSINADO: crédito positivo, débito negativo. */
  valueCents: Cents
  description: string
  paymentId?: string
  splitId?: string
  transferId?: string
  anticipationId?: string
  billId?: string
  invoiceId?: string
}

export interface LedgerDeps {
  clock: Clock
  rng: Rng
}

/**
 * Grava os lançamentos e atualiza o saldo. Chame DENTRO de uma transação.
 *
 * A ordem importa: o `balanceCents` de cada linha é o saldo DEPOIS dela, então
 * um recebimento gera PAYMENT_RECEIVED (+bruto) e depois PAYMENT_FEE (−taxa),
 * exatamente como o extrato do Asaas mostra.
 */
export async function postEntries(
  tx: DB,
  deps: LedgerDeps,
  entries: readonly LedgerEntry[],
): Promise<void> {
  if (!entries.length) return

  const today = deps.clock.today()
  const now = deps.clock.timestamp()

  for (const entry of entries) {
    const [account] = await tx
      .select({ balanceCents: accounts.balanceCents })
      .from(accounts)
      .where(eq(accounts.id, entry.accountId))
      .limit(1)

    if (!account) throw new Error(`Ledger: conta inexistente ${entry.accountId}`)

    const balanceAfter = account.balanceCents + entry.valueCents

    const [next] = await tx
      .select({ seq: sql<number>`COALESCE(MAX(${financialTransactions.seq}), 0) + 1` })
      .from(financialTransactions)
    const seq = next?.seq ?? 1

    await tx.insert(financialTransactions).values({
      id: deps.rng.uuid(),
      seq,
      accountId: entry.accountId,
      type: entry.type,
      valueCents: entry.valueCents,
      balanceCents: balanceAfter,
      description: entry.description,
      date: today,
      paymentId: entry.paymentId ?? null,
      splitId: entry.splitId ?? null,
      transferId: entry.transferId ?? null,
      anticipationId: entry.anticipationId ?? null,
      billId: entry.billId ?? null,
      invoiceId: entry.invoiceId ?? null,
      dateCreated: now,
    })

    await tx
      .update(accounts)
      .set({ balanceCents: balanceAfter })
      .where(eq(accounts.id, entry.accountId))
  }
}
