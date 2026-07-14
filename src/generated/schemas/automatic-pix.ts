// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { PixAutomaticRecurringAuthorizationRetryPolicy, PixAutomaticRecurringFrequency, PixAutomaticRecurringOriginType, PixAutomaticRecurringPaymentCreationMode, PixReceiverAutomaticRecurringAuthorizationStatus } from '../enums.ts'

/** Linked authorization information */
export const PixAutomaticRecurringPaymentInstructionAuthorizationResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the linked Pix Automatic authorization", examples: ["35363f6e-93e2-11ec-b9d9-96f4053b1bd4"] }))),
    "endToEndIdentifier": Type.Optional(Nullable(Type.String({ description: "End to End identifier of the linked Pix Automatic authorization", examples: ["RR1234567820240115abcdefghijk"] }))),
    "customerId": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier", examples: ["cus_000005735721"] }))),
  })
export type PixAutomaticRecurringPaymentInstructionAuthorizationResponse = (typeof PixAutomaticRecurringPaymentInstructionAuthorizationResponse)['static']

export const PixAutomaticRecurringPaymentInstructionGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique Automatic Pix payment instruction identifier in Asaas", examples: ["cbfdf6ef-9bd8-48ba-b8cd-efd61a9f614c"] }))),
    "endToEndIdentifier": Type.Optional(Nullable(Type.String({ description: "End to End identifier", examples: ["E00416968202111161635q5bk0brYk2C"] }))),
    "authorization": Type.Optional(Nullable(PixAutomaticRecurringPaymentInstructionAuthorizationResponse)),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Payment instruction due date", examples: ["2020-01-31"] }))),
    "status": Type.Optional(Nullable(Type.Union([Type.Literal("AWAITING_REQUEST"), Type.Literal("SCHEDULED"), Type.Literal("DONE"), Type.Literal("CANCELLED"), Type.Literal("REFUSED")]))),
    "paymentId": Type.Optional(Nullable(Type.String({ description: "Unique linked payment identifier", examples: ["pay_tsp88gie3b5e6o2p"] }))),
    "purpose": Type.Optional(Nullable(Type.Union([Type.Literal("RETRY_AFTER_DUE_DATE"), Type.Literal("SCHEDULE")]))),
    "refusalReason": Type.Optional(Nullable(Type.String({ description: "Reason why the payment instruction was refused", examples: [null] }))),
    "retryAttempt": Type.Optional(Nullable(Type.Integer({ description: "Retry attempt number of the payment instruction", examples: [1] }))),
  })
export type PixAutomaticRecurringPaymentInstructionGetResponse = (typeof PixAutomaticRecurringPaymentInstructionGetResponse)['static']

export const PixAutomaticRecurringPaymentInstructionListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PixAutomaticRecurringPaymentInstructionGetResponse))),
  })
export type PixAutomaticRecurringPaymentInstructionListResponse = (typeof PixAutomaticRecurringPaymentInstructionListResponse)['static']

export const PixAutomaticRecurringPaymentInstructionSaveRetryRequest = Type.Object({
    "dueDate": Type.String({ description: "Due date", examples: ["2020-01-31"] }),
  })
export type PixAutomaticRecurringPaymentInstructionSaveRetryRequest = (typeof PixAutomaticRecurringPaymentInstructionSaveRetryRequest)['static']

/** Immediate charge information */
export const PixReceiverAutomaticRecurringAuthorizationImmediateQrCodeResponse = Type.Object({
    "conciliationIdentifier": Type.Optional(Nullable(Type.String({ description: "Conciliation identifier", examples: ["E12345678202401011234567890123456"] }))),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "First charge expiration date", examples: ["2024-01-01 12:00:00"] }))),
  })
export type PixReceiverAutomaticRecurringAuthorizationImmediateQrCodeResponse = (typeof PixReceiverAutomaticRecurringAuthorizationImmediateQrCodeResponse)['static']

export const PixReceiverAutomaticRecurringAuthorizationGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique Automatic Pix authorization identifier in Asaas", examples: ["a33047b1-fb19-4b68-9373-a7ba8a8162aa"] }))),
    "minLimitValue": Type.Optional(Nullable(Type.Number({ description: "If the paying user sets a maximum amount for payments under that authorization, it cannot be lower than the minimum amount defined by the receiving user. This field cannot be filled in fixed-amount authorizations, that is, when the amount field is already filled", examples: [50] }))),
    "cancellationDate": Type.Optional(Nullable(Type.String({ description: "Authorization cancellation date", examples: [null] }))),
    "cancellationReason": Type.Optional(Nullable(Type.String({ description: "Cancellation reason", examples: [null] }))),
    "contractId": Type.Optional(Nullable(Type.String({ description: "Number, identifier, or code representing the authorization object", examples: ["XXXYYYY1234"] }))),
    "customerId": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier", examples: ["cus_000005735721"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Authorization description", examples: ["Music and Movie Streaming Services"] }))),
    "finishDate": Type.Optional(Nullable(Type.String({ description: "End of authorization validity", examples: ["2024-12-31"] }))),
    "frequency": Type.Optional(Nullable(PixAutomaticRecurringFrequency)),
    "endToEndIdentifier": Type.Optional(Nullable(Type.String({ description: "End to End identifier", examples: ["RR1234567820240115abcdefghijk"] }))),
    "startDate": Type.Optional(Nullable(Type.String({ description: "Start of authorization validity and payments", examples: ["2024-01-01"] }))),
    "status": Type.Optional(Nullable(PixReceiverAutomaticRecurringAuthorizationStatus)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Fixed amount for periodic charges", examples: [100] }))),
    "payload": Type.Optional(Nullable(Type.String({ description: "QR Code payload", examples: [null] }))),
    "encodedImage": Type.Optional(Nullable(Type.String({ description: "QR Code image in base64", examples: [null] }))),
    "immediateQrCode": Type.Optional(Nullable(PixReceiverAutomaticRecurringAuthorizationImmediateQrCodeResponse)),
    "originType": Type.Optional(Nullable(PixAutomaticRecurringOriginType)),
    "subscriptionId": Type.Optional(Nullable(Type.String({ description: "Unique linked subscription identifier", examples: ["sub_000005735721"] }))),
    "paymentCreationMode": Type.Optional(Nullable(PixAutomaticRecurringPaymentCreationMode)),
    "retryPolicy": Type.Optional(Nullable(PixAutomaticRecurringAuthorizationRetryPolicy)),
  })
export type PixReceiverAutomaticRecurringAuthorizationGetResponse = (typeof PixReceiverAutomaticRecurringAuthorizationGetResponse)['static']

/** Immediate charge linked to authorization activation */
export const PixReceiverAutomaticRecurringAuthorizationImmediateQrCodeRequest = Type.Object({
    "pixKey": Type.Optional(Nullable(Type.String({ description: "Pix key linked to the first charge", examples: ["b6295ee1-f054-47d1-9e90-ee57b74f60d9"] }))),
    "expirationSeconds": Type.Integer({ description: "Expiration time in seconds for the first charge", examples: [3600] }),
    "originalValue": Type.Number({ description: "Original value of the first charge", examples: [100] }),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the first charge", examples: ["Account opening fee"] }))),
  })
export type PixReceiverAutomaticRecurringAuthorizationImmediateQrCodeRequest = (typeof PixReceiverAutomaticRecurringAuthorizationImmediateQrCodeRequest)['static']

export const PixReceiverAutomaticRecurringAuthorizationListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PixReceiverAutomaticRecurringAuthorizationGetResponse))),
  })
export type PixReceiverAutomaticRecurringAuthorizationListResponse = (typeof PixReceiverAutomaticRecurringAuthorizationListResponse)['static']

export const PixReceiverAutomaticRecurringAuthorizationSaveRequest = Type.Object({
    "frequency": PixAutomaticRecurringFrequency,
    "contractId": Type.String({ description: "Number, identifier, or code representing the authorization object", examples: ["CONTRACT-123"] }),
    "startDate": Type.String({ description: "Start of authorization validity and payments", examples: ["2024-01-01"] }),
    "finishDate": Type.Optional(Nullable(Type.String({ description: "End of authorization validity. Optional if the Automatic Pix is for an indefinite period", examples: ["2024-12-31"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Fixed amount for periodic charges.", examples: [100] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description", examples: ["Music and Movie Streaming Services"] }))),
    "customerId": Type.String({ description: "Unique customer identifier", examples: ["cus_000005735721"] }),
    "immediateQrCode": PixReceiverAutomaticRecurringAuthorizationImmediateQrCodeRequest,
    "minLimitValue": Type.Optional(Nullable(Type.Number({ description: "If the paying user sets a maximum amount for payments under that authorization, it cannot be lower than the minimum amount defined by the receiving user. This field cannot be filled in fixed-amount authorizations, that is, when the value field is already filled", examples: [50] }))),
    "paymentCreationMode": Type.Optional(Nullable(PixAutomaticRecurringPaymentCreationMode)),
    "retryPolicy": Type.Optional(Nullable(PixAutomaticRecurringAuthorizationRetryPolicy)),
  })
export type PixReceiverAutomaticRecurringAuthorizationSaveRequest = (typeof PixReceiverAutomaticRecurringAuthorizationSaveRequest)['static']
