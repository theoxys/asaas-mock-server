/**
 * A liquidação das transferências externas. (Track D)
 *
 * O ciclo real: PENDING → BANK_PROCESSING → DONE. Uma transferência não some da
 * conta e reaparece no destino no mesmo instante — ela fica "no banco", e é
 * justamente esse intervalo que o dev precisa conseguir atravessar sem esperar.
 *
 *   PIX → DONE no mesmo dia (a rede é 24×7).
 *   TED → DONE no PRÓXIMO DIA ÚTIL. Uma TED pedida na sexta cai na segunda.
 *
 * A transferência INTERNA nunca passa por aqui: já nasce DONE, porque o dinheiro
 * não sai da plataforma.
 *
 * Toda mutação é COMPARE-AND-SWAP (`WHERE id = ? AND status = <esperado>`): dois
 * ticks no mesmo dia simulado alteram zero linhas na segunda vez.
 */
import { and, eq, isNull, lte, ne, or } from 'drizzle-orm'
import type { DB } from '../../db/client.ts'
import { transfers } from '../../db/schema/index.ts'
import { transferEffectiveDate, type TransferOperationType } from '../../domain/transfer.ts'
import {
  emitTransfer,
  isSandboxFailure,
  reverse,
  settlementArtifacts,
} from '../../modules/transfers/service.ts'
import { serializeTransfer, type TransferRow } from '../../modules/transfers/serializer.ts'
import type { Job } from '../scheduler.ts'

export const transferSettlement: Job = {
  name: 'transfer-settlement',

  async run({ ctx, report }) {
    const today = ctx.clock.today()

    await ctx.db.transaction(async (tx) => {
      const db = tx as unknown as DB

      // ── 1. PENDING → BANK_PROCESSING ────────────────────────────────
      // Só as que já podem sair: uma transferência agendada para daqui a três
      // dias continua PENDING (e o saldo já foi debitado na criação).
      const pending = await db
        .select()
        .from(transfers)
        .where(
          and(
            eq(transfers.status, 'PENDING'),
            ne(transfers.operationType, 'INTERNAL'),
            or(isNull(transfers.scheduleDate), lte(transfers.scheduleDate, today)),
          ),
        )

      for (const row of pending as TransferRow[]) {
        const effectiveDate = transferEffectiveDate(
          row.operationType as TransferOperationType,
          today,
        )

        const updated = await db
          .update(transfers)
          .set({ status: 'BANK_PROCESSING', effectiveDate })
          .where(and(eq(transfers.id, row.id), eq(transfers.status, 'PENDING')))
          .returning()

        if (!updated.length) continue
        const after = updated[0] as TransferRow

        report.transitions.push({
          resource: 'transfer',
          id: after.id,
          from: 'PENDING',
          to: 'BANK_PROCESSING',
          job: 'transfer-settlement',
        })

        await emitTransfer(
          ctx,
          db,
          after.accountId,
          after.id,
          'TRANSFER_IN_BANK_PROCESSING',
          serializeTransfer(after),
        )
      }

      // ── 2. BANK_PROCESSING → DONE (ou FAILED) ───────────────────────
      const processing = await db
        .select()
        .from(transfers)
        .where(
          and(
            eq(transfers.status, 'BANK_PROCESSING'),
            lte(transfers.effectiveDate, today),
          ),
        )

      for (const row of processing as TransferRow[]) {
        const failed = isSandboxFailure(row)

        const patch = failed
          ? {
              status: 'FAILED',
              failReason: 'Transferência recusada pela instituição de destino.',
            }
          : { status: 'DONE', ...settlementArtifacts(ctx, row) }

        const updated = await db
          .update(transfers)
          .set(patch)
          .where(and(eq(transfers.id, row.id), eq(transfers.status, 'BANK_PROCESSING')))
          .returning()

        if (!updated.length) continue
        const after = updated[0] as TransferRow

        // A falha DEVOLVE o dinheiro — valor e taxa. Lançamento novo
        // (TRANSFER_REVERSAL), nunca a remoção do débito original: o ledger é
        // append-only e o extrato tem que contar o que aconteceu de verdade.
        if (failed) {
          await reverse(ctx, db, after, 'Estorno de transferência não realizada')
          report.ledgerEntries += 1
        }

        report.transitions.push({
          resource: 'transfer',
          id: after.id,
          from: 'BANK_PROCESSING',
          to: after.status,
          job: 'transfer-settlement',
        })

        await emitTransfer(
          ctx,
          db,
          after.accountId,
          after.id,
          failed ? 'TRANSFER_FAILED' : 'TRANSFER_DONE',
          serializeTransfer(after),
        )
      }
    })
  },
}
