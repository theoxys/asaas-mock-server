// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { PixRecurringTransactionFrequency, PixRecurringTransactionItemStatus, PixRecurringTransactionOrigin, PixRecurringTransactionStatus } from '../enums.ts'

export const PixRecurringTransactionCancelItemRequest = Type.Object({})
export type PixRecurringTransactionCancelItemRequest = (typeof PixRecurringTransactionCancelItemRequest)['static']

/** Receiver information */
export const PixRecurringTransactionExternalAccount = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Receiver name", examples: ["John Doe"] }))),
    "financialInstitutionName": Type.Optional(Nullable(Type.String({ description: "Payment institution name", examples: ["Example bank S.A"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "Receiver CPF or CNPJ", examples: ["***.456.789-**"] }))),
    "pixKey": Type.Optional(Nullable(Type.String({ description: "Receiver Pix key", examples: ["***.456.789-**"] }))),
  })
export type PixRecurringTransactionExternalAccount = (typeof PixRecurringTransactionExternalAccount)['static']

export const PixRecurringTransactionGetItemResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique recurrence item identifier in Asaas", examples: ["71ae9d73-468f-4d04-8b87-a541128f9c46"] }))),
    "status": Type.Optional(Nullable(PixRecurringTransactionItemStatus)),
    "scheduledDate": Type.Optional(Nullable(Type.String({ description: "Recurrence item scheduled date", examples: ["2024-10-23"] }))),
    "canBeCancelled": Type.Optional(Nullable(Type.Boolean({ description: "Whether the recurrence item can be cancelled", examples: [true] }))),
    "recurrenceNumber": Type.Optional(Nullable(Type.Integer({ description: "Recurrence number", examples: [1] }))),
    "quantity": Type.Optional(Nullable(Type.Integer({ description: "Number of repetitions", examples: [2] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Recurrence value", examples: [0.02] }))),
    "refusalReasonDescription": Type.Optional(Nullable(Type.String({ description: "Recurrence item refusal reason", examples: [null] }))),
    "externalAccount": Type.Optional(Nullable(PixRecurringTransactionExternalAccount)),
  })
export type PixRecurringTransactionGetItemResponse = (typeof PixRecurringTransactionGetItemResponse)['static']

export const PixRecurringTransactionGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique recurrence identifier in Asaas", examples: ["35363f6e-93e2-11ec-b9d9-96f4053b1bd4"] }))),
    "status": Type.Optional(Nullable(PixRecurringTransactionStatus)),
    "origin": Type.Optional(Nullable(PixRecurringTransactionOrigin)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Recurrence value", examples: [0.02] }))),
    "frequency": Type.Optional(Nullable(PixRecurringTransactionFrequency)),
    "quantity": Type.Optional(Nullable(Type.Integer({ description: "Number of repetitions", examples: [2] }))),
    "startDate": Type.Optional(Nullable(Type.String({ description: "Recurrence start date", examples: ["2024-09-18"] }))),
    "finishDate": Type.Optional(Nullable(Type.String({ description: "Recurrence finish date", examples: ["2024-09-25"] }))),
    "canBeCancelled": Type.Optional(Nullable(Type.Boolean({ description: "Whether the recurrence can be cancelled", examples: [true] }))),
    "externalAccount": Type.Optional(Nullable(PixRecurringTransactionExternalAccount)),
  })
export type PixRecurringTransactionGetResponse = (typeof PixRecurringTransactionGetResponse)['static']

export const PixRecurringTransactionListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PixRecurringTransactionGetResponse))),
  })
export type PixRecurringTransactionListResponse = (typeof PixRecurringTransactionListResponse)['static']

export const RecurringPixTransactionListItemsResponse = Type.Object({
    "data": Type.Optional(Nullable(Type.Array(PixRecurringTransactionGetItemResponse))),
  })
export type RecurringPixTransactionListItemsResponse = (typeof RecurringPixTransactionListItemsResponse)['static']

export const RecurringPixTransactionPathIdRequest = Type.Object({})
export type RecurringPixTransactionPathIdRequest = (typeof RecurringPixTransactionPathIdRequest)['static']
