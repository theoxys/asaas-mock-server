// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { AnticipationStatus } from '../enums.ts'
import { File } from './common.ts'

export const AnticipationConfigurationGetResponse = Type.Object({
    "creditCardAutomaticEnabled": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether automatic anticipation is enabled for credit card payments", examples: [false] }))),
  })
export type AnticipationConfigurationGetResponse = (typeof AnticipationConfigurationGetResponse)['static']

export const AnticipationConfigurationUpdateRequest = Type.Object({
    "creditCardAutomaticEnabled": Type.Optional(Nullable(Type.Boolean({ description: "Define whether automatic anticipation is enabled for credit card payments", examples: [null] }))),
  })
export type AnticipationConfigurationUpdateRequest = (typeof AnticipationConfigurationUpdateRequest)['static']

export const AnticipationGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["receivableAnticipation"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique identifier of anticipation in Asaas", examples: ["9e7d8639-350f-45c0-8bc3-d4ddc5f4ebac"] }))),
    "installment": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the installment to be anticipated", examples: [null] }))),
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment to be anticipated.", examples: ["pay_626366773834"] }))),
    "status": Type.Optional(Nullable(AnticipationStatus)),
    "anticipationDate": Type.Optional(Nullable(Type.String({ description: "Anticipation request date", examples: ["2019-05-20"] }))),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Request due date", examples: ["2019-05-26"] }))),
    "requestDate": Type.Optional(Nullable(Type.String({ description: "Anticipation request date", examples: ["2019-05-14"] }))),
    "fee": Type.Optional(Nullable(Type.Number({ description: "Anticipation fee", examples: [2.33] }))),
    "anticipationDays": Type.Optional(Nullable(Type.Integer({ description: "Number of days that were anticipated", examples: [5] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net value discounted the anticipation fee", examples: [73.68] }))),
    "totalValue": Type.Optional(Nullable(Type.Number({ description: "Total amount of the payment to be anticipated", examples: [80] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Anticipation value", examples: [76.01] }))),
    "denialObservation": Type.Optional(Nullable(Type.String({ description: "Reason for rejecting the anticipation payment", examples: [null] }))),
  })
export type AnticipationGetResponse = (typeof AnticipationGetResponse)['static']

/** Credit card anticipation limits */
export const AnticipationLimitsInfoResponse = Type.Object({
    "total": Type.Optional(Nullable(Type.Number({ description: "Anticipation limit released on the account", examples: [50000] }))),
    "available": Type.Optional(Nullable(Type.Number({ description: "Limit available to anticipate", examples: [35360.7] }))),
  })
export type AnticipationLimitsInfoResponse = (typeof AnticipationLimitsInfoResponse)['static']

export const AnticipationLimitsResponse = Type.Object({
    "creditCard": Type.Optional(Nullable(AnticipationLimitsInfoResponse)),
    "bankSlip": Type.Optional(Nullable(AnticipationLimitsInfoResponse)),
  })
export type AnticipationLimitsResponse = (typeof AnticipationLimitsResponse)['static']

export const AnticipationListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(AnticipationGetResponse))),
  })
export type AnticipationListResponse = (typeof AnticipationListResponse)['static']

export const AnticipationPathIdRequest = Type.Object({})
export type AnticipationPathIdRequest = (typeof AnticipationPathIdRequest)['static']

export const AnticipationSaveRequest = Type.Object({
    "installment": Type.Optional(Nullable(Type.String({ description: "ID of the installment to be anticipated", examples: [null] }))),
    "payment": Type.Optional(Nullable(Type.String({ description: "ID of the payment to be anticipated", examples: ["pay_626366773834"] }))),
    "documents": Type.Optional(Nullable(File)),
  })
export type AnticipationSaveRequest = (typeof AnticipationSaveRequest)['static']

export const AnticipationSimulateRequest = Type.Object({
    "installment": Type.Optional(Nullable(Type.String({ description: "ID of the installment to be anticipated", examples: [null] }))),
    "payment": Type.Optional(Nullable(Type.String({ description: "ID of the payment to be anticipated", examples: ["pay_626366773834"] }))),
  })
export type AnticipationSimulateRequest = (typeof AnticipationSimulateRequest)['static']

export const AnticipationSimulateResponse = Type.Object({
    "installment": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the installment to be anticipated", examples: [null] }))),
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment to be anticipated", examples: ["pay_626366773834"] }))),
    "anticipationDate": Type.Optional(Nullable(Type.String({ description: "Anticipation request date", examples: ["2019-05-20"] }))),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Request due date", examples: ["2019-05-26"] }))),
    "fee": Type.Optional(Nullable(Type.Number({ description: "Anticipation fee", examples: [2.33] }))),
    "anticipationDays": Type.Optional(Nullable(Type.Integer({ description: "Number of days that were anticipated", examples: [6] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net value discounted the anticipation fee", examples: [73.68] }))),
    "totalValue": Type.Optional(Nullable(Type.Number({ description: "Total amount of the payment to be anticipated", examples: [80] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Anticipation value", examples: [76.01] }))),
    "isDocumentationRequired": Type.Optional(Nullable(Type.Boolean({ description: "Determines the obligation to send electronic invoices or service provision contracts when requesting anticipation payment", examples: [false] }))),
  })
export type AnticipationSimulateResponse = (typeof AnticipationSimulateResponse)['static']
