// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { PaymentGetResponseBillingType, PaymentStatus } from '../enums.ts'
import { PaymentDiscount, PaymentFineResponse, PaymentInterestResponse, PaymentSaveWithCreditCardCreditCard } from './common.ts'

export const PaymentLeanGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["payment"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique payment identifier in Asaas", examples: ["pay_080225913252"] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Payment creation date", examples: ["2017-03-10"] }))),
    "customerId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the customer to whom the payment belongs", examples: ["cus_G7Dvo4iphUNk"] }))),
    "subscriptionId": Type.Optional(Nullable(Type.String({ description: "Unique subscription identifier (when recurring billing)", examples: [null] }))),
    "installmentId": Type.Optional(Nullable(Type.String({ description: "Unique installment identifier (when billing in installments)", examples: [null] }))),
    "paymentLinkId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payments link to which the payment belongs", examples: [null] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Payment amount", examples: [129.9] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net value of the charge after discounting the Asaas fee", examples: [124.9] }))),
    "originalValue": Type.Optional(Nullable(Type.Number({ description: "Original amount of charge (filled when paid with interest and fine)", examples: [null] }))),
    "interestValue": Type.Optional(Nullable(Type.Number({ description: "Calculated amount of interest and fine that must be paid after the charge is due", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the payment", examples: ["Pedido 056984"] }))),
    "billingType": Type.Optional(Nullable(PaymentGetResponseBillingType)),
    "canBePaidAfterDueDate": Type.Optional(Nullable(Type.Boolean({ description: "Informs whether the charge can be paid after the due date (Only for bank slip)", examples: [true] }))),
    "confirmedDate": Type.Optional(Nullable(Type.String({ description: "Billing confirmation date", examples: ["2017-03-10"] }))),
    "pixTransactionId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the Pix transaction to which the payment belongs", examples: [null] }))),
    "status": Type.Optional(Nullable(PaymentStatus)),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Payment due date", examples: ["2017-06-10"] }))),
    "originalDueDate": Type.Optional(Nullable(Type.String({ description: "Original due date upon creation of the payment", examples: ["2017-06-10"] }))),
    "paymentDate": Type.Optional(Nullable(Type.String({ description: "Payment date on Asaas", examples: [null] }))),
    "customerPaymentDate": Type.Optional(Nullable(Type.String({ description: "Date on which the customer paid the bank slip", examples: [null] }))),
    "installmentNumber": Type.Optional(Nullable(Type.Integer({ description: "Parcel number", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field", examples: ["056984"] }))),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Determines if the payment has been removed", examples: [false] }))),
    "anticipated": Type.Optional(Nullable(Type.Boolean({ description: "Defines whether the charge was anticipated or is in the process of being anticipated", examples: [false] }))),
    "anticipable": Type.Optional(Nullable(Type.Boolean({ description: "Determines whether the charge is anticipated", examples: [false] }))),
    "creditDate": Type.Optional(Nullable(Type.String({ description: "Billing Credit date", examples: ["2017-03-10"] }))),
    "transactionReceiptUrl": Type.Optional(Nullable(Type.String({ description: "URL of proof of confirmation, receipt, reversal or removal", examples: [null] }))),
    "duplicatedPaymentId": Type.Optional(Nullable(Type.String({ description: "Duplicate billing identifier (if true)", examples: [null] }))),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "fine": Type.Optional(Nullable(PaymentFineResponse)),
    "interest": Type.Optional(Nullable(PaymentInterestResponse)),
    "postalService": Type.Optional(Nullable(Type.Boolean({ description: "Define whether the payment will be sent via post", examples: [false] }))),
  })
export type PaymentLeanGetResponse = (typeof PaymentLeanGetResponse)['static']

export const PaymentLeanListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentLeanGetResponse))),
  })
export type PaymentLeanListResponse = (typeof PaymentLeanListResponse)['static']

export const PaymentLeanSaveWithCreditCardResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["payment"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique payment identifier in Asaas", examples: ["pay_080225913252"] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Payment creation date", examples: ["2017-03-10"] }))),
    "customerId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the customer to whom the payment belongs", examples: ["cus_G7Dvo4iphUNk"] }))),
    "subscriptionId": Type.Optional(Nullable(Type.String({ description: "Unique subscription identifier (when recurring billing)", examples: [null] }))),
    "installmentId": Type.Optional(Nullable(Type.String({ description: "Unique installment identifier (when billing in installments)", examples: [null] }))),
    "paymentLinkId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payments link to which the payment belongs", examples: [null] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Payment amount", examples: [129.9] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net value of the charge after discounting the Asaas fee", examples: [124.9] }))),
    "originalValue": Type.Optional(Nullable(Type.Number({ description: "Original amount of charge (filled when paid with interest and fine)", examples: [null] }))),
    "interestValue": Type.Optional(Nullable(Type.Number({ description: "Calculated amount of interest and fine that must be paid after the charge is due", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the payment", examples: ["Pedido 056984"] }))),
    "billingType": Type.Optional(Nullable(PaymentGetResponseBillingType)),
    "canBePaidAfterDueDate": Type.Optional(Nullable(Type.Boolean({ description: "Informs whether the charge can be paid after the due date (Only for bank slip)", examples: [true] }))),
    "confirmedDate": Type.Optional(Nullable(Type.String({ description: "Billing confirmation date", examples: ["2017-03-10"] }))),
    "pixTransactionId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the Pix transaction to which the payment belongs", examples: [null] }))),
    "status": Type.Optional(Nullable(PaymentStatus)),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Payment due date", examples: ["2017-06-10"] }))),
    "originalDueDate": Type.Optional(Nullable(Type.String({ description: "Original due date upon creation of the payment", examples: ["2017-06-10"] }))),
    "paymentDate": Type.Optional(Nullable(Type.String({ description: "Payment date on Asaas", examples: [null] }))),
    "customerPaymentDate": Type.Optional(Nullable(Type.String({ description: "Date on which the customer paid the bank slip", examples: [null] }))),
    "installmentNumber": Type.Optional(Nullable(Type.Integer({ description: "Parcel number", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field", examples: ["056984"] }))),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Determines if the payment has been removed", examples: [false] }))),
    "anticipated": Type.Optional(Nullable(Type.Boolean({ description: "Defines whether the charge was anticipated or is in the process of being anticipated", examples: [false] }))),
    "anticipable": Type.Optional(Nullable(Type.Boolean({ description: "Determines whether the charge is anticipated", examples: [false] }))),
    "creditDate": Type.Optional(Nullable(Type.String({ description: "Billing Credit date", examples: ["2017-03-10"] }))),
    "transactionReceiptUrl": Type.Optional(Nullable(Type.String({ description: "URL of proof of confirmation, receipt, reversal or removal", examples: [null] }))),
    "duplicatedPaymentId": Type.Optional(Nullable(Type.String({ description: "Duplicate billing identifier (if true)", examples: [null] }))),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "fine": Type.Optional(Nullable(PaymentFineResponse)),
    "interest": Type.Optional(Nullable(PaymentInterestResponse)),
    "postalService": Type.Optional(Nullable(Type.Boolean({ description: "Define whether the payment will be sent via post", examples: [false] }))),
    "creditCard": Type.Optional(Nullable(PaymentSaveWithCreditCardCreditCard)),
  })
export type PaymentLeanSaveWithCreditCardResponse = (typeof PaymentLeanSaveWithCreditCardResponse)['static']
