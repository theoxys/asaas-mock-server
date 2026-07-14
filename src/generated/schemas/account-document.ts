// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { AccountDocumentGroupResponseAccountDocumentStatus, AccountDocumentResponsibleType, AccountDocumentStatus, AccountDocumentType } from '../enums.ts'
import { File } from './common.ts'

export const AccountDocumentDeleteResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the document was removed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique document identifier in Asaas", examples: ["8d257732-2220-11ec-b695-b6af4a64184d"] }))),
  })
export type AccountDocumentDeleteResponse = (typeof AccountDocumentDeleteResponse)['static']

export const AccountDocumentGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique document identifier in Asaas", examples: ["8d257732-2220-11ec-b695-b6af4a64184d"] }))),
    "status": Type.Optional(Nullable(AccountDocumentStatus)),
  })
export type AccountDocumentGetResponse = (typeof AccountDocumentGetResponse)['static']

/** Who is responsible for sending these documents */
export const AccountDocumentResponsibleResponse = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Responsible name", examples: ["John Doe"] }))),
    "type": Type.Optional(Nullable(AccountDocumentResponsibleType)),
  })
export type AccountDocumentResponsibleResponse = (typeof AccountDocumentResponsibleResponse)['static']

/** List of objects */
export const AccountDocumentGroupResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique document group identifier in Asaas", examples: ["172ed152-4fa4-43ad-9b69-39c323e9526c"] }))),
    "status": Type.Optional(Nullable(AccountDocumentGroupResponseAccountDocumentStatus)),
    "type": Type.Optional(Nullable(AccountDocumentType)),
    "title": Type.Optional(Nullable(Type.String({ description: "Document group title", examples: ["Minutes of election of the last board"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description", examples: ["No description"] }))),
    "responsible": Type.Optional(Nullable(AccountDocumentResponsibleResponse)),
    "onboardingUrl": Type.Optional(Nullable(Type.String({ description: "URL for sending documents", examples: ["https://example.com/cadastro.io/8ad196d6cbfcc5d05bfabcbb5c730f6a"] }))),
    "onboardingUrlExpirationDate": Type.Optional(Nullable(Type.String({ description: "Expiration date of the URL for sending documents", examples: ["2025-03-04 00:00:00"] }))),
    "documents": Type.Optional(Nullable(Type.Array(AccountDocumentGetResponse))),
  })
export type AccountDocumentGroupResponse = (typeof AccountDocumentGroupResponse)['static']

export const AccountDocumentSaveRequest = Type.Object({
    "documentFile": Type.Optional(Nullable(File)),
    "type": Type.Optional(Nullable(AccountDocumentType)),
  })
export type AccountDocumentSaveRequest = (typeof AccountDocumentSaveRequest)['static']

export const AccountDocumentShowResponse = Type.Object({
    "rejectReasons": Type.Optional(Nullable(Type.String({ description: "Reason why account approval was rejected", examples: [null] }))),
    "data": Type.Optional(Nullable(Type.Array(AccountDocumentGroupResponse))),
  })
export type AccountDocumentShowResponse = (typeof AccountDocumentShowResponse)['static']

export const AccountDocumentUpdateRequest = Type.Object({
    "documentFile": File,
  })
export type AccountDocumentUpdateRequest = (typeof AccountDocumentUpdateRequest)['static']
