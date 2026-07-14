// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { ChargebackDisputeStatus } from '../enums.ts'
import { PaymentChargebackResponse } from './common.ts'

export const ChargebackListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentChargebackResponse))),
  })
export type ChargebackListResponse = (typeof ChargebackListResponse)['static']

export const ChargebackSaveDisputeRequest = Type.Object({
    "files": Type.Any(),
  })
export type ChargebackSaveDisputeRequest = (typeof ChargebackSaveDisputeRequest)['static']

export const ChargebackSaveDisputeResponse = Type.Object({
    "chargebackId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of chargeback for which the dispute will be created.", examples: ["2765d086-c7c5-5cca-898a-4262d212587c"] }))),
    "status": Type.Optional(Nullable(ChargebackDisputeStatus)),
    "files": Type.Optional(Nullable(Type.Array(Type.String({ description: "Names of the dispute files.", examples: [null] })))),
  })
export type ChargebackSaveDisputeResponse = (typeof ChargebackSaveDisputeResponse)['static']
