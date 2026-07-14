// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'

export const FinanceBalanceResponse = Type.Object({
    "balance": Type.Optional(Nullable(Type.Number({ description: "Account balance", examples: [5210.96] }))),
  })
export type FinanceBalanceResponse = (typeof FinanceBalanceResponse)['static']

export const FinanceGetPaymentStatisticsResponse = Type.Object({
    "quantity": Type.Optional(Nullable(Type.Integer({ description: "Number of charges", examples: [23] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Amount", examples: [9270.4] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Total net worth", examples: [9121.54] }))),
  })
export type FinanceGetPaymentStatisticsResponse = (typeof FinanceGetPaymentStatisticsResponse)['static']

export const FinanceGetSplitStatisticsResponse = Type.Object({
    "income": Type.Optional(Nullable(Type.Number({ description: "Amounts receivable", examples: [5210.96] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Values to be sent", examples: [9270.4] }))),
  })
export type FinanceGetSplitStatisticsResponse = (typeof FinanceGetSplitStatisticsResponse)['static']
