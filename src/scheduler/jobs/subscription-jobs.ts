/**
 * Job 1 — geração das cobranças de assinatura, da SEGUNDA em diante. (Track E)
 *
 * A primeira cobrança NÃO nasce aqui: nasce no `POST /v3/subscriptions`, junto
 * com a assinatura. (Acreditávamos o contrário — que nenhuma cobrança existia
 * até faltarem 40 dias para o vencimento — e a captura contra o sandbox real
 * provou que estávamos errados. Ver o cabeçalho de `modules/subscriptions/handlers.ts`.)
 *
 * O que este job faz é manter a esteira andando: quando o `nextDueDate` entra na
 * janela de LOOKAHEAD (40 dias, `SUBSCRIPTION_LOOKAHEAD_DAYS`), a próxima
 * cobrança é gerada e o ciclo avança de novo.
 *
 * Roda PRIMEIRO no tick: a cobrança gerada hoje tem que poder vencer hoje, e os
 * jobs seguintes (overdue, credit-settlement) precisam vê-la.
 *
 * A geração em si mora em `modules/subscriptions/service.ts` (`generateOne`) —
 * porque tem dois chamadores, e uma segunda implementação aqui divergiria da do
 * POST no dia em que uma das duas fosse corrigida.
 *
 * IDEMPOTÊNCIA — a camada que de fato salva é o COMPARE-AND-SWAP, dentro de
 * `generateOne`: a linha da assinatura é RECLAMADA (next_due_date avançado)
 * antes de a cobrança nascer. Um tick repetido encontra o vencimento já
 * consumido, altera zero linhas e não gera nada. Duas cobranças para o mesmo
 * vencimento são impossíveis por construção, não por convenção.
 */
import { and, eq, lte } from 'drizzle-orm'
import { subscriptions } from '../../db/schema/index.ts'
import { addDays } from '../../domain/calendar.ts'
import { generateOne, type SubscriptionRow } from '../../modules/subscriptions/service.ts'
import type { Job } from '../scheduler.ts'

export const subscriptionGeneration: Job = {
  name: 'subscription-generation',

  async run({ ctx, report }) {
    const today = ctx.clock.today()

    /**
     * A JANELA. Uma cobrança nasce quando faltam `lookaheadDays` (40) ou menos
     * para o vencimento — nem um dia antes. No 41º dia, nada acontece.
     */
    const horizon = addDays(today, ctx.config.rules.subscriptionLookaheadDays)

    const due = await ctx.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'ACTIVE'),
          eq(subscriptions.deleted, false),
          lte(subscriptions.nextDueDate, horizon),
        ),
      )

    for (const sub of due) {
      /**
       * Um ciclo curto tem VÁRIOS vencimentos dentro da janela — numa assinatura
       * semanal, 40 dias de lookahead cobrem ~6 cobranças, e o Asaas as cria
       * todas. Por isso o laço: geramos enquanto o próximo vencimento continuar
       * dentro do horizonte.
       */
      let current: SubscriptionRow | null = sub

      while (current && current.status === 'ACTIVE' && current.nextDueDate <= horizon) {
        try {
          current = await generateOne(ctx, current, report)
        } catch (err) {
          ctx.log('error', `subscription-generation: ${sub.id} falhou`, {
            error: String(err),
          })
          break
        }
      }
    }
  },
}
