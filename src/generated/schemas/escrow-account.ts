// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'

export const AccountPaymentEscrowConfig = Type.Object({
    "daysToExpire": Type.Integer({ description: "Number of days to expire the payment escrow", examples: [30] }),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the Escrow Account is enabled", examples: [true] }))),
    "isFeePayer": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the subaccount is responsible for paying the Escrow Account fee. If not informed, the main account will be responsible for the fee", examples: [false] }))),
  })
export type AccountPaymentEscrowConfig = (typeof AccountPaymentEscrowConfig)['static']

export const AccountSaveOrUpdatePaymentEscrowConfigRequest = Type.Object({
    "daysToExpire": Type.Integer({ description: "Number of days to expire the payment escrow", examples: [30] }),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the Escrow Account is enabled", examples: [true] }))),
    "isFeePayer": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the subaccount is responsible for paying the Escrow Account fee. If not informed, the main account will be responsible for the fee", examples: [false] }))),
  })
export type AccountSaveOrUpdatePaymentEscrowConfigRequest = (typeof AccountSaveOrUpdatePaymentEscrowConfigRequest)['static']

export const PaymentEscrowPathIdRequest = Type.Object({})
export type PaymentEscrowPathIdRequest = (typeof PaymentEscrowPathIdRequest)['static']
