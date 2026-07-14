// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'

/** List of objects */
export const ReceivableRegistrationRestrictionItem = Type.Object({
    "beneficiaryCpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF/CNPJ of the financial institution that benefits from the contract effect", examples: [null] }))),
    "externalIdentifier": Type.Optional(Nullable(Type.String({ description: "Contract identifier that originated the effect", examples: [null] }))),
  })
export type ReceivableRegistrationRestrictionItem = (typeof ReceivableRegistrationRestrictionItem)['static']

export const ReceivableRegistrationResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(ReceivableRegistrationRestrictionItem))),
  })
export type ReceivableRegistrationResponse = (typeof ReceivableRegistrationResponse)['static']
