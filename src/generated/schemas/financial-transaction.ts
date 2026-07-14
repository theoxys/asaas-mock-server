// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { FinancialTransactionType } from '../enums.ts'

/** List of objects */
export const FinancialTransactionGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["financialTransaction"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique transaction identifier in Asaas", examples: ["ftn_000015274322"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Transaction value", examples: [-5.99] }))),
    "balance": Type.Optional(Nullable(Type.Number({ description: "Value in account at the time of the transaction", examples: [3772.81] }))),
    "type": Type.Optional(Nullable(FinancialTransactionType)),
    "date": Type.Optional(Nullable(Type.String({ description: "Transaction date", examples: ["2017-06-10"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Transaction description", examples: ["Taxa de transferência para conta bancária"] }))),
    "paymentId": Type.Optional(Nullable(Type.String({ description: "Payment identifier (If any)", examples: [null] }))),
    "splitId": Type.Optional(Nullable(Type.String({ description: "Split identifier (If any)", examples: [null] }))),
    "transferId": Type.Optional(Nullable(Type.String({ description: "Transfer identifier (If any)", examples: ["b26df110-498b-40ba-b5c6-1428de4d59c7"] }))),
    "anticipationId": Type.Optional(Nullable(Type.String({ description: "Anticipation identifier (If any)", examples: [null] }))),
    "billId": Type.Optional(Nullable(Type.String({ description: "Bill payment identifier (If any)", examples: [null] }))),
    "invoiceId": Type.Optional(Nullable(Type.String({ description: "Invoice identifier (If any)", examples: [null] }))),
    "paymentDunningId": Type.Optional(Nullable(Type.String({ description: "Payment dunning identifier (If any)", examples: [null] }))),
    "creditBureauReportId": Type.Optional(Nullable(Type.String({ description: "Serasa consultation identifier (If any)", examples: [null] }))),
  })
export type FinancialTransactionGetResponse = (typeof FinancialTransactionGetResponse)['static']

export const FinancialTransactionListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(FinancialTransactionGetResponse))),
  })
export type FinancialTransactionListResponse = (typeof FinancialTransactionListResponse)['static']
