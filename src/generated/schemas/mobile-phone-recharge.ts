// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { MobilePhoneRechargeStatus } from '../enums.ts'

/** Amounts available for recharge */
export const MobilePhoneRechargeFindProviderResponseValues = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Package name", examples: ["R$ 12,00"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Package Description", examples: [null] }))),
    "bonus": Type.Optional(Nullable(Type.String({ description: "Package Bonuses", examples: ["0.0"] }))),
    "minValue": Type.Optional(Nullable(Type.Number({ description: "Minimum top-up amount", examples: [12] }))),
    "maxValue": Type.Optional(Nullable(Type.Number({ description: "Maximum recharge value", examples: [12] }))),
  })
export type MobilePhoneRechargeFindProviderResponseValues = (typeof MobilePhoneRechargeFindProviderResponseValues)['static']

export const MobilePhoneRechargeFindProviderResponse = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Name of cell phone operator", examples: ["Vivo"] }))),
    "values": Type.Optional(Nullable(Type.Array(MobilePhoneRechargeFindProviderResponseValues))),
  })
export type MobilePhoneRechargeFindProviderResponse = (typeof MobilePhoneRechargeFindProviderResponse)['static']

export const MobilePhoneRechargeGetRequest = Type.Object({})
export type MobilePhoneRechargeGetRequest = (typeof MobilePhoneRechargeGetRequest)['static']

export const MobilePhoneRechargeGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique identifier for cell phone recharge on Asaas", examples: ["37c22147-4194-11ec-8061-0242ac120002"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Recharge value", examples: [15] }))),
    "phoneNumber": Type.Optional(Nullable(Type.String({ description: "Cell phone number that was requested to be recharged", examples: ["63997365512"] }))),
    "status": Type.Optional(Nullable(MobilePhoneRechargeStatus)),
    "canBeCancelled": Type.Optional(Nullable(Type.Boolean({ description: "Whether the top-up can be canceled", examples: [null] }))),
    "operatorName": Type.Optional(Nullable(Type.String({ description: "Name of cell phone operator", examples: ["Vivo"] }))),
  })
export type MobilePhoneRechargeGetResponse = (typeof MobilePhoneRechargeGetResponse)['static']

export const MobilePhoneRechargeListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(MobilePhoneRechargeGetResponse))),
  })
export type MobilePhoneRechargeListResponse = (typeof MobilePhoneRechargeListResponse)['static']

export const MobilePhoneRechargeSaveRequest = Type.Object({
    "value": Type.Number({ description: "Recharge value", examples: [15] }),
    "phoneNumber": Type.String({ description: "Cellphone number", examples: ["63997365512"] }),
  })
export type MobilePhoneRechargeSaveRequest = (typeof MobilePhoneRechargeSaveRequest)['static']
