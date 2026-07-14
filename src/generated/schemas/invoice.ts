// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { InvoiceTaxesRequest } from './common.ts'

export const InvoiceCancelRequest = Type.Object({
    "cancelOnlyOnAsaas": Type.Optional(Nullable(Type.Boolean({ description: "Cancel invoice only on Asaas", examples: [null] }))),
  })
export type InvoiceCancelRequest = (typeof InvoiceCancelRequest)['static']

export const InvoicePathIdRequest = Type.Object({})
export type InvoicePathIdRequest = (typeof InvoicePathIdRequest)['static']

export const InvoiceSaveRequest = Type.Object({
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique payment identifier in Asaas", examples: ["pay_637959110194"] }))),
    "installment": Type.Optional(Nullable(Type.String({ description: "Unique installment identifier in Asaas", examples: [null] }))),
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier", examples: ["cus_000000002750"] }))),
    "serviceDescription": Type.String({ description: "Description of invoice services", examples: [null] }),
    "observations": Type.String({ description: "Additional observations", examples: ["Monthly for June work."] }),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Invoice identifier in your system", examples: [null] }))),
    "value": Type.Number({ description: "Total value", examples: [300] }),
    "deductions": Type.Number({ description: "Deductions. Deductions do not change the total value of the invoice, but they do change the ISS calculation basis.", examples: [10] }),
    "effectiveDate": Type.String({ description: "Invoice issuance date", examples: ["2024-08-20"] }),
    "municipalServiceId": Type.Optional(Nullable(Type.String({ description: "Unique municipal service identifier", examples: [null] }))),
    "municipalServiceCode": Type.Optional(Nullable(Type.String({ description: "Municipal Service Code", examples: ["1.01"] }))),
    "municipalServiceName": Type.String({ description: "Name of the municipal service. If not provided, the municipalServiceCode attribute will be used as the name for identification.", examples: ["Systems analysis and development"] }),
    "updatePayment": Type.Optional(Nullable(Type.Boolean({ description: "Update the Payment amount with the invoice taxes already deducted.", examples: [null] }))),
    "taxes": InvoiceTaxesRequest,
  })
export type InvoiceSaveRequest = (typeof InvoiceSaveRequest)['static']

export const InvoiceUpdateRequest = Type.Object({
    "serviceDescription": Type.Optional(Nullable(Type.String({ description: "Description of invoice services", examples: [null] }))),
    "observations": Type.Optional(Nullable(Type.String({ description: "Additional observations", examples: ["Monthly for June work."] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Invoice identifier in your system", examples: [null] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Total value", examples: [300] }))),
    "deductions": Type.Optional(Nullable(Type.Number({ description: "Deductions. Deductions do not change the total value of the invoice, but they do change the ISS calculation basis.", examples: [10] }))),
    "effectiveDate": Type.Optional(Nullable(Type.String({ description: "Invoice issuance date", examples: ["2024-08-20"] }))),
    "updatePayment": Type.Optional(Nullable(Type.Boolean({ description: "Update the Payment amount with the invoice taxes already deducted.", examples: [null] }))),
    "taxes": Type.Optional(Nullable(InvoiceTaxesRequest)),
  })
export type InvoiceUpdateRequest = (typeof InvoiceUpdateRequest)['static']
