// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'

export const CreditBureauReportGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique report identifier in Asaas", examples: ["6c5e73fa-9efd-4a75-b60c-1cafb8d1c7ed"] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Date of consultation", examples: ["2025-05-30"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ consulted manually", examples: ["05666663755"] }))),
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier in Asaas", examples: ["cus_000000001766"] }))),
    "downloadUrl": Type.Optional(Nullable(Type.String({ description: "Url to download the report. Available until 11:59 pm on the day of the appointment.", examples: ["https://www.asaas.com.br/creditBureauReport/download/6c5e73fa-9efd-4a75-b60c-1cafb8d1c7ed"] }))),
    "reportFile": Type.Optional(Nullable(Type.String({ description: "PDF of the query report in Base64 (this field is only returned when the report is created)", examples: [null] }))),
  })
export type CreditBureauReportGetResponse = (typeof CreditBureauReportGetResponse)['static']

export const CreditBureauReportListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(CreditBureauReportGetResponse))),
  })
export type CreditBureauReportListResponse = (typeof CreditBureauReportListResponse)['static']

export const CreditBureauReportSaveRequest = Type.Object({
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier in Asaas", examples: [null] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the customer. Enter this field if your client is not registered with Asaas", examples: ["05666663755"] }))),
  })
export type CreditBureauReportSaveRequest = (typeof CreditBureauReportSaveRequest)['static']
