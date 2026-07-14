/**
 * Os jobs do split. (Track F)
 *
 * É AQUI que o dinheiro de fato atravessa a fronteira entre duas contas — o
 * resto do split (o cálculo, o status) já existia; o que faltava era o
 * movimento. Um split que muda de status mas não move saldo é exatamente o tipo
 * de mock sutilmente errado que este projeto não pode ser.
 *
 * REGRAS QUE MORAM AQUI:
 *
 * 1. O split incide sobre o **netValue** (valor − taxa do Asaas), nunca sobre o
 *    bruto. O cálculo é `computeSplits` (puro, src/domain/split.ts) — e é
 *    REFEITO no momento do crédito, sobre o netValue FINAL da cobrança. Uma
 *    cobrança paga em atraso vale mais (juros + multa), logo o netValue é maior
 *    e o split percentual acompanha. É o que a doc do Asaas quer dizer com "os
 *    valores exibidos podem ser atualizados após a confirmação do pagamento".
 *
 * 2. Saldo só muda via `postEntries()`, e os DOIS extratos fecham:
 *    INTERNAL_TRANSFER_DEBIT (−) na origem, INTERNAL_TRANSFER_CREDIT (+) no
 *    destino, ambos carimbados com splitId e paymentId.
 *
 * 3. Compare-and-swap em toda mutação (`UPDATE … WHERE status = 'AWAITING_CREDIT'`).
 *    Uma execução duplicada do job altera zero linhas — e é essa camada, não o
 *    mutex, que impede o crédito em dobro.
 */
import { and, eq, inArray, lt } from 'drizzle-orm'
import { postEntries } from '../../core/ledger.ts'
import type { DB } from '../../db/client.ts'
import { payments, paymentSplits } from '../../db/schema/index.ts'
import { addBusinessDays } from '../../domain/calendar.ts'
import { cents } from '../../domain/money.ts'
import { computeSplits, type SplitSpec } from '../../domain/split.ts'
import { serializePayment, type PaymentRow } from '../../modules/payments/serializer.ts'
import type { Job } from '../scheduler.ts'

type SplitRow = typeof paymentSplits.$inferSelect

/** A linha do banco vira a entrada da função pura. */
function toSpec(s: SplitRow): SplitSpec {
  return {
    walletId: s.walletId,
    fixedValueCents: s.fixedValueCents === null ? null : cents(s.fixedValueCents),
    percentualValueE4:
      s.percentualValueE4 === null ? null : (s.percentualValueE4 as SplitSpec['percentualValueE4']),
    externalReference: s.externalReference,
    description: s.description,
  }
}

/**
 * Job 4 — splits AWAITING_CREDIT de cobranças já RECEBIDAS → DONE, movendo o
 * dinheiro entre as contas.
 *
 * Roda DEPOIS do credit-settlement (job 3) de propósito: só existe split do que
 * já entrou. Um cartão pago hoje só libera o split em D+32, no mesmo tick em que
 * a cobrança credita — e é isso que o teste de viagem no tempo prova.
 */
export const splitRelease: Job = {
  name: 'split-release',
  async run({ ctx, report }) {
    const today = ctx.clock.today()

    /**
     * Só cobrança RECEBIDA libera split. CONFIRMED não serve: o dinheiro ainda
     * não é da conta de origem, e não se pode transferir o que não se tem.
     */
    const pending = await ctx.db
      .select({ split: paymentSplits, payment: payments })
      .from(paymentSplits)
      .innerJoin(payments, eq(paymentSplits.paymentId, payments.id))
      .where(
        and(
          eq(paymentSplits.status, 'AWAITING_CREDIT'),
          eq(payments.status, 'RECEIVED'),
          eq(payments.deleted, false),
        ),
      )

    // Agrupa por cobrança: a divergência de valor é uma propriedade do CONJUNTO
    // de splits, não de um split isolado.
    const byPayment = new Map<string, { payment: PaymentRow; splits: SplitRow[] }>()
    for (const row of pending) {
      const entry = byPayment.get(row.payment.id) ?? {
        payment: row.payment as PaymentRow,
        splits: [],
      }
      entry.splits.push(row.split)
      byPayment.set(row.payment.id, entry)
    }

    for (const { payment, splits } of byPayment.values()) {
      try {
        await ctx.db.transaction(async (t) => {
          const tx = t as unknown as DB

          // Recalculado sobre o netValue FINAL — ver o comentário no topo.
          const computed = computeSplits(cents(payment.netValueCents), splits.map(toSpec))

          /**
           * A soma passou a exceder o netValue (a cobrança foi editada para
           * menos depois de criada, por exemplo). Não credita: bloqueia, e o
           * job de divergência assume a partir daqui.
           */
          if (computed.divergent) {
            const blockedUntil = addBusinessDays(
              today,
              ctx.config.rules.splitDivergenceGraceBusinessDays,
            )

            const blocked = await tx
              .update(paymentSplits)
              .set({ status: 'BLOCKED_BY_VALUE_DIVERGENCE', blockedUntil })
              .where(
                and(
                  inArray(
                    paymentSplits.id,
                    splits.map((s) => s.id),
                  ),
                  eq(paymentSplits.status, 'AWAITING_CREDIT'),
                ),
              )
              .returning()

            if (!blocked.length) return // outro tick já tratou

            for (const s of blocked) {
              report.transitions.push({
                resource: 'split',
                id: s.id,
                from: 'AWAITING_CREDIT',
                to: 'BLOCKED_BY_VALUE_DIVERGENCE',
                job: 'split-release',
              })
            }

            await emitSplitEvent(ctx, tx, payment, 'PAYMENT_SPLIT_DIVERGENCE_BLOCK')
            return
          }

          for (const [i, split] of splits.entries()) {
            const total = computed.splits[i]!.totalValueCents

            /**
             * COMPARE-AND-SWAP. É o que impede o crédito em dobro se o job rodar
             * duas vezes: a segunda execução altera zero linhas e cai fora ANTES
             * de tocar no ledger.
             */
            const updated = await tx
              .update(paymentSplits)
              .set({ status: 'DONE', creditDate: today, totalValueCents: total })
              .where(
                and(
                  eq(paymentSplits.id, split.id),
                  eq(paymentSplits.status, 'AWAITING_CREDIT'),
                ),
              )
              .returning()

            if (!updated.length) continue

            /**
             * CARTEIRA EXTERNA: o walletId não é de nenhuma conta deste servidor,
             * então `recipientAccountId` é null e NÃO HÁ CONTA PARA CREDITAR.
             *
             * Marcamos DONE (o split "aconteceu"), mas nenhum centavo se move —
             * inclusive na origem. É uma DIVERGÊNCIA DELIBERADA com o Asaas real,
             * onde o dinheiro sairia da sua conta rumo à carteira de outro
             * cliente do Asaas. Aqui o dinheiro simplesmente não tem para onde ir,
             * e debitar a origem sem creditar ninguém faria o extrato "sumir" com
             * o valor sem contrapartida — algo que ninguém conseguiria conferir.
             *
             * Para ver o dinheiro andar de verdade, crie uma subconta
             * (POST /v3/accounts) e use o walletId dela.
             */
            if (!split.recipientAccountId) {
              report.transitions.push({
                resource: 'split',
                id: split.id,
                from: 'AWAITING_CREDIT',
                to: 'DONE',
                job: 'split-release',
              })
              continue
            }

            /**
             * O movimento. Débito na origem, crédito no destino, na MESMA
             * transação — os dois extratos fecham ou nenhum dos dois fecha.
             */
            await postEntries(tx, { clock: ctx.clock, rng: ctx.rng }, [
              {
                accountId: payment.accountId,
                type: 'INTERNAL_TRANSFER_DEBIT',
                valueCents: cents(-total),
                description: `Split da cobrança ${payment.id}`,
                paymentId: payment.id,
                splitId: split.id,
              },
              {
                accountId: split.recipientAccountId,
                type: 'INTERNAL_TRANSFER_CREDIT',
                valueCents: total,
                description: `Split recebido da cobrança ${payment.id}`,
                paymentId: payment.id,
                splitId: split.id,
              },
            ])

            report.ledgerEntries += 2
            report.transitions.push({
              resource: 'split',
              id: split.id,
              from: 'AWAITING_CREDIT',
              to: 'DONE',
              job: 'split-release',
            })
          }
        })
      } catch (err) {
        ctx.log('debug', `split-release: cobrança ${payment.id} não liberou`, {
          error: String(err),
        })
      }
    }
  },
}

/**
 * Job 5 — o prazo de ajuste de um split bloqueado por divergência expirou.
 *
 * O Asaas bloqueia o split quando a soma excede o netValue e dá 2 DIAS ÚTEIS
 * (`SPLIT_DIVERGENCE_GRACE_BUSINESS_DAYS`) para o integrador corrigir os valores.
 * Passou o prazo, o split morre: CANCELLED com `VALUE_DIVERGENCE_BLOCK`.
 *
 * `blockedUntil` é o ÚLTIMO dia em que ainda dá para ajustar — por isso o
 * predicado é `blockedUntil < hoje`, e não `<=`. TODO(regra): a doc não diz se o
 * prazo vence no fim do último dia ou no início dele.
 */
export const splitDivergenceExpiry: Job = {
  name: 'split-divergence-expiry',
  async run({ ctx, report }) {
    const today = ctx.clock.today()

    const expired = await ctx.db
      .select({ split: paymentSplits, payment: payments })
      .from(paymentSplits)
      .innerJoin(payments, eq(paymentSplits.paymentId, payments.id))
      .where(
        and(
          eq(paymentSplits.status, 'BLOCKED_BY_VALUE_DIVERGENCE'),
          lt(paymentSplits.blockedUntil, today),
        ),
      )

    for (const { split, payment } of expired) {
      try {
        await ctx.db.transaction(async (t) => {
          const tx = t as unknown as DB

          // CAS: se alguém ajustou o split neste meio-tempo, nada acontece.
          const updated = await tx
            .update(paymentSplits)
            .set({ status: 'CANCELLED', cancellationReason: 'VALUE_DIVERGENCE_BLOCK' })
            .where(
              and(
                eq(paymentSplits.id, split.id),
                eq(paymentSplits.status, 'BLOCKED_BY_VALUE_DIVERGENCE'),
              ),
            )
            .returning()

          if (!updated.length) return

          report.transitions.push({
            resource: 'split',
            id: split.id,
            from: 'BLOCKED_BY_VALUE_DIVERGENCE',
            to: 'CANCELLED',
            job: 'split-divergence-expiry',
          })

          /**
           * Dois eventos, e não é redundância: o bloqueio terminou
           * (DIVERGENCE_BLOCK_FINISHED) E o split foi cancelado (SPLIT_CANCELLED).
           * TODO(regra): a doc lista os dois eventos mas não diz se o Asaas emite
           * ambos neste caminho.
           */
          await emitSplitEvent(
            ctx,
            tx,
            payment as PaymentRow,
            'PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED',
          )
          await emitSplitEvent(ctx, tx, payment as PaymentRow, 'PAYMENT_SPLIT_CANCELLED')
        })
      } catch (err) {
        ctx.log('debug', `split-divergence-expiry: split ${split.id} não cancelou`, {
          error: String(err),
        })
      }
    }
  },
}

/**
 * O payload de um evento de split.
 *
 * TODO(regra): a spec não declara um `resourceType` "split" — os 111 eventos
 * carregam `payment`, `subscription`, `transfer`… Mandamos a COBRANÇA, cujo
 * campo `split[]` já traz cada split com status, valor e motivo do cancelamento.
 * É a leitura mais defensável: o cliente recebe tudo que precisa, no formato que
 * ele já sabe ler.
 */
async function emitSplitEvent(
  ctx: Parameters<Job['run']>[0]['ctx'],
  tx: DB,
  payment: PaymentRow,
  event: string,
): Promise<void> {
  const [fresh] = await tx.select().from(payments).where(eq(payments.id, payment.id)).limit(1)

  await ctx.emit(tx, {
    accountId: payment.accountId,
    event,
    resourceType: 'payment',
    resourceId: payment.id,
    resource: await serializePayment(tx, (fresh ?? payment) as PaymentRow),
  })
}
