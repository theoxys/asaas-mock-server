// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { PaymentRefundGetResponse } from './common.ts'

export const PaymentBankSlipRefundResponse = Type.Object({
    "requestUrl": Type.Optional(Nullable(Type.String({ description: "Link to report refund details", examples: ["https://sandbox.asaas.com/solicitar-estorno/37ij5mdxwo1234"] }))),
  })
export type PaymentBankSlipRefundResponse = (typeof PaymentBankSlipRefundResponse)['static']

export const PaymentRefundListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentRefundGetResponse))),
  })
export type PaymentRefundListResponse = (typeof PaymentRefundListResponse)['static']
