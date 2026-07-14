// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { PaymentDocumentType } from '../enums.ts'
import { File } from './common.ts'

export const PaymentDocumentDeleteResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the file was removed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique document identifier", examples: ["609a3f98-8db7-4a89-b511-de4c3be6d462"] }))),
  })
export type PaymentDocumentDeleteResponse = (typeof PaymentDocumentDeleteResponse)['static']

/** File object */
export const PaymentDocumentFileResponse = Type.Object({
    "publicId": Type.Optional(Nullable(Type.String({ description: "Unique document identifier", examples: ["TSrLvzPGF7HPQhYu9OZhZSBX3mm1sxpToEcFm30imOM3sKEjhzCc1zAIuqQ7n11"] }))),
    "originalName": Type.Optional(Nullable(Type.String({ description: "Original document name", examples: ["Nota Fiscal.pdf"] }))),
    "size": Type.Optional(Nullable(Type.Integer({ description: "File size", examples: [14499] }))),
    "extension": Type.Optional(Nullable(Type.String({ description: "File extension", examples: ["pdf"] }))),
    "previewUrl": Type.Optional(Nullable(Type.String({ description: "Link to download the file preview", examples: ["https://www.asaas.com/file/preview/TSrLvzPGF7HPQhYu9OZhZSBX3mm1sxpToEcFm30imOM3sKEjhzCc1zAIuqQ7n11"] }))),
    "downloadUrl": Type.Optional(Nullable(Type.String({ description: "Link to download the file", examples: ["https://www.asaas.com/file/public/download/TSrLvzPGF7HPQhYu9OZhZSBX3mm1sxpToEcFm30imOM3sKEjhzCc1zAIuqQ7n11"] }))),
  })
export type PaymentDocumentFileResponse = (typeof PaymentDocumentFileResponse)['static']

export const PaymentDocumentGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["paymentDocument"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique document identifier", examples: ["609a3f98-8db7-4a89-b511-de4c3be6d462"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Document name", examples: ["Nota Fiscal.pdf"] }))),
    "type": Type.Optional(Nullable(PaymentDocumentType)),
    "availableAfterPayment": Type.Optional(Nullable(Type.Boolean({ description: "Available only after payment", examples: [true] }))),
    "file": Type.Optional(Nullable(PaymentDocumentFileResponse)),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the file was removed", examples: [false] }))),
  })
export type PaymentDocumentGetResponse = (typeof PaymentDocumentGetResponse)['static']

export const PaymentDocumentListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentDocumentGetResponse))),
  })
export type PaymentDocumentListResponse = (typeof PaymentDocumentListResponse)['static']

export const PaymentDocumentSaveRequest = Type.Object({
    "availableAfterPayment": Type.Boolean({ description: "true to make the file available only after receipt of the payment", examples: [true] }),
    "type": PaymentDocumentType,
    "file": File,
  })
export type PaymentDocumentSaveRequest = (typeof PaymentDocumentSaveRequest)['static']

export const PaymentDocumentUpdateRequest = Type.Object({
    "availableAfterPayment": Type.Boolean({ description: "true to make the file available only after receipt of the payment", examples: [true] }),
    "type": PaymentDocumentType,
  })
export type PaymentDocumentUpdateRequest = (typeof PaymentDocumentUpdateRequest)['static']
