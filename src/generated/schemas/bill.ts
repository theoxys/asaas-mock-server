// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { BillStatus } from '../enums.ts'

export const BillCancelRequest = Type.Object({})
export type BillCancelRequest = (typeof BillCancelRequest)['static']

export const BillGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["bill"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique bill payment identifier in Asaas", examples: ["f1bce822-6f37-4905-8de8-f1af9f2f4bab"] }))),
    "status": Type.Optional(Nullable(BillStatus)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Amount to be paid", examples: [29] }))),
    "discount": Type.Optional(Nullable(Type.Number({ description: "Discount attributed to payment", examples: [0] }))),
    "interest": Type.Optional(Nullable(Type.Number({ description: "Interest attributed to payment", examples: [0] }))),
    "fine": Type.Optional(Nullable(Type.Number({ description: "Fine assigned to payment", examples: [0] }))),
    "identificationField": Type.Optional(Nullable(Type.String({ description: "Typeable line of the bill to be paid", examples: ["03399.77779 29900.000000 04751.101017 1 81510000002990"] }))),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Billing due date", examples: ["2020-01-31"] }))),
    "scheduleDate": Type.Optional(Nullable(Type.String({ description: "Payment scheduling date", examples: ["2020-01-31"] }))),
    "paymentDate": Type.Optional(Nullable(Type.String({ description: "Date on which payment was made", examples: [null] }))),
    "fee": Type.Optional(Nullable(Type.Number({ description: "Asaas fee for bill payment", examples: [0] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Bill Payment Description", examples: ["Celular 01/12"] }))),
    "companyName": Type.Optional(Nullable(Type.String({ description: "Company/Body issuing the payment", examples: [null] }))),
    "transactionReceiptUrl": Type.Optional(Nullable(Type.String({ description: "Proof of bill payment", examples: ["https://www.asaas.com/comprovantes/00016578"] }))),
    "canBeCancelled": Type.Optional(Nullable(Type.Boolean({ description: "Whether payment can be canceled", examples: [false] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the bill in your system", examples: [null] }))),
    "failReasons": Type.Optional(Nullable(Type.Array(Type.String({ description: "List of reasons for payment failure", examples: [null] })))),
  })
export type BillGetResponse = (typeof BillGetResponse)['static']

export const BillListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(BillGetResponse))),
  })
export type BillListResponse = (typeof BillListResponse)['static']

export const BillSaveRequest = Type.Object({
    "identificationField": Type.String({ description: "Digitizable bill line", examples: ["03399.77779 29900.000000 04751.101017 1 81510000002990"] }),
    "scheduleDate": Type.Optional(Nullable(Type.String({ description: "Payment scheduling date", examples: ["2020-03-15"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Bill Payment Description", examples: ["Celular 03/12"] }))),
    "discount": Type.Optional(Nullable(Type.Number({ description: "Discount attributed to payment", examples: [0] }))),
    "interest": Type.Optional(Nullable(Type.Number({ description: "Interest attributed to payment", examples: [0] }))),
    "fine": Type.Optional(Nullable(Type.Number({ description: "Fine assigned to payment", examples: [0] }))),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Expiration date of the account if it is the type that does not have this information", examples: ["2020-03-30"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Account value if it is the type that does not have this information (Ex: credit card invoices)", examples: [29] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the bill in your system", examples: ["056984"] }))),
  })
export type BillSaveRequest = (typeof BillSaveRequest)['static']

/** Information about the bill to be paid */
export const BillSimulateBankSlipInfoResponse = Type.Object({
    "identificationField": Type.Optional(Nullable(Type.String({ description: "Digitable line", examples: ["03399201595100529040147600301023888440000421177"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Ticket value", examples: [4211.77] }))),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Due date", examples: ["2021-12-24"] }))),
    "companyName": Type.Optional(Nullable(Type.String({ description: "Company/Body issuing the bill", examples: [null] }))),
    "bank": Type.Optional(Nullable(Type.String({ description: "Code of the bank issuing the bill in the banking system", examples: ["033"] }))),
    "beneficiaryCpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the beneficiary", examples: ["19.540.550/0001-21"] }))),
    "beneficiaryName": Type.Optional(Nullable(Type.String({ description: "Beneficiary's name", examples: ["ASAAS GESTAO FINANCEIRA S.A."] }))),
    "allowChangeValue": Type.Optional(Nullable(Type.Boolean({ description: "Whether the value can be changed or not", examples: [false] }))),
    "minValue": Type.Optional(Nullable(Type.Number({ description: "Minimum value that can be changed", examples: [4211.77] }))),
    "maxValue": Type.Optional(Nullable(Type.Number({ description: "Maximum value that can be changed", examples: [4211.77] }))),
    "discountValue": Type.Optional(Nullable(Type.Number({ description: "Value of discounts", examples: [0] }))),
    "interestValue": Type.Optional(Nullable(Type.Number({ description: "Interest amount", examples: [0] }))),
    "fineValue": Type.Optional(Nullable(Type.Number({ description: "Fine value", examples: [0] }))),
    "originalValue": Type.Optional(Nullable(Type.Number({ description: "Original bill value", examples: [4211.77] }))),
    "totalDiscountValue": Type.Optional(Nullable(Type.Number({ description: "Total value of discounts and rebates", examples: [0] }))),
    "totalAdditionalValue": Type.Optional(Nullable(Type.Number({ description: "Total amount of interest and fine", examples: [0] }))),
    "isOverdue": Type.Optional(Nullable(Type.Boolean({ description: "Informs if the ticket is expired", examples: [false] }))),
  })
export type BillSimulateBankSlipInfoResponse = (typeof BillSimulateBankSlipInfoResponse)['static']

export const BillSimulateRequest = Type.Object({
    "identificationField": Type.Optional(Nullable(Type.String({ description: "Digitizable bill line", examples: ["03399.77779 29900.000000 04751.101017 1 81510000002990"] }))),
    "barCode": Type.Optional(Nullable(Type.String({ description: "Ticket barcode", examples: [null] }))),
  })
export type BillSimulateRequest = (typeof BillSimulateRequest)['static']

export const BillSimulateResponse = Type.Object({
    "minimumScheduleDate": Type.Optional(Nullable(Type.String({ description: "Minimum date allowed for scheduling", examples: ["2021-11-22"] }))),
    "fee": Type.Optional(Nullable(Type.Number({ description: "Fee charged when paying the bill", examples: [0] }))),
    "bankSlipInfo": Type.Optional(Nullable(BillSimulateBankSlipInfoResponse)),
  })
export type BillSimulateResponse = (typeof BillSimulateResponse)['static']
