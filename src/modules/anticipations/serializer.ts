import type { anticipations } from '../../db/schema/index.ts'
import { cents, centsToBrl } from '../../domain/money.ts'

export type AnticipationRow = typeof anticipations.$inferSelect

const money = (v: number | null): number | null => (v === null ? null : centsToBrl(cents(v)))

export function serializeAnticipation(a: AnticipationRow): Record<string, unknown> {
  return {
    object: 'receivableAnticipation',
    id: a.id, // UUID puro
    installment: a.installmentId,
    payment: a.paymentId,
    status: a.status,
    anticipationDate: a.anticipationDate,
    dueDate: a.dueDate,
    requestDate: a.requestDate,
    fee: money(a.feeCents),
    anticipationDays: a.anticipationDays,
    netValue: money(a.netValueCents),
    totalValue: money(a.totalValueCents),
    value: money(a.valueCents),
    denialObservation: a.denialObservation,
  }
}
