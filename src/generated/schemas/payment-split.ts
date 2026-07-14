// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { PaymentSplitCancellationReason, PaymentSplitStatus } from '../enums.ts'

/** Payment data associated with the split */
export const PaymentSplitPaymentInfoResponse = Type.Object({
    "confirmedDate": Type.Optional(Nullable(Type.String({ description: "Payment confirmed date", examples: ["2026-03-11"] }))),
    "invoiceNumber": Type.Optional(Nullable(Type.String({ description: "Invoice number", examples: ["00110291"] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "External identifier of the payment", examples: [null] }))),
  })
export type PaymentSplitPaymentInfoResponse = (typeof PaymentSplitPaymentInfoResponse)['static']

export const PaymentSplitGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique split identifier in Asaas", examples: ["fd41396a-7453-47d0-9411-c8543522591d"] }))),
    "walletId": Type.Optional(Nullable(Type.String({ description: "Asaas wallet identifier that will be transferred", examples: ["7bafd95a-e783-4a62-9be1-23999af742c6"] }))),
    "fixedValue": Type.Optional(Nullable(Type.Number({ description: "Fixed amount to be transferred to the account when the charge is received", examples: [20.32] }))),
    "percentualValue": Type.Optional(Nullable(Type.Number({ description: "Percentage of the net value of the charge to be transferred when received", examples: [null] }))),
    "totalValue": Type.Optional(Nullable(Type.Number({ description: "Amount that will be split relative to the total amount that will be paid. The displayed values may be updated after the payment is confirmed or modified.", examples: [20.32] }))),
    "cancellationReason": Type.Optional(Nullable(PaymentSplitCancellationReason)),
    "status": Type.Optional(Nullable(PaymentSplitStatus)),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Unique identifier of split in your system", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Split description", examples: [null] }))),
    "originAccountId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the split origin account", examples: ["dd6daeb7-a89b-4f37-968b-f53dd450c987"] }))),
    "destinationAccountId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the split destination account", examples: ["0e42da80-1347-4f4f-b6a9-80142ec90dd2"] }))),
    "creditDate": Type.Optional(Nullable(Type.String({ description: "Split payment date", examples: ["2026-03-11"] }))),
    "payment": Type.Optional(Nullable(PaymentSplitPaymentInfoResponse)),
  })
export type PaymentSplitGetResponse = (typeof PaymentSplitGetResponse)['static']

export const PaymentSplitListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentSplitGetResponse))),
  })
export type PaymentSplitListResponse = (typeof PaymentSplitListResponse)['static']
