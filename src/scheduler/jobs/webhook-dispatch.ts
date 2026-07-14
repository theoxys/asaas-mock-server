/**
 * Job 7 — entrega os webhooks vencidos.
 *
 * NÃO é `once()`: não é um job diário. Toda vez que o tempo anda (um tick, um
 * advance, o timer), a fila é drenada. Um evento emitido às 10h e uma retentativa
 * marcada para as 10h30 são dois instantes diferentes do mesmo dia simulado.
 *
 * A lógica de verdade está em src/webhooks/dispatcher.ts.
 */
import { dispatchDue } from '../../webhooks/dispatcher.ts'
import type { Job } from '../scheduler.ts'

export const webhookDispatch: Job = {
  name: 'webhook-dispatch',
  async run({ ctx, report, paused }) {
    await dispatchDue(ctx, report, paused)
  },
}
