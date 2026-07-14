// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { BillingType, PaymentGetResponseBillingType, PaymentRefundStatus, PaymentSplitCancellationReason, PaymentSplitStatus } from '../enums.ts'
import { CreditCardHolderInfoRequest, CreditCardRequest, PaymentChargebackResponse, PaymentDiscount, PaymentFineRequest, PaymentInterestRequest, PaymentRefundedSplitResponse, PaymentSaveWithCreditCardCreditCard } from './common.ts'

/** List of payments that were removed */
export const InstallmentPaymentDeleted = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique payment identifier in Asaas", examples: ["pay_080225913252"] }))),
    "installmentNumber": Type.Optional(Nullable(Type.String({ description: "Parcel number", examples: [1] }))),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Determines if the payment has been removed", examples: [true] }))),
  })
export type InstallmentPaymentDeleted = (typeof InstallmentPaymentDeleted)['static']

export const InstallmentDeletePaymentsResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the installment plan is removed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique installment identifier in Asaas", examples: ["a2c890b-dd63-4b5a-9169-96c8d7828f4c"] }))),
    "deletedPayments": Type.Optional(Nullable(Type.Array(InstallmentPaymentDeleted))),
  })
export type InstallmentDeletePaymentsResponse = (typeof InstallmentDeletePaymentsResponse)['static']

export const InstallmentDeleteResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the installment plan is removed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique installment identifier in Asaas", examples: ["a2c890b-dd63-4b5a-9169-96c8d7828f4c"] }))),
  })
export type InstallmentDeleteResponse = (typeof InstallmentDeleteResponse)['static']

/** Refunds information */
export const InstallmentRefundResponse = Type.Object({
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Refund creation date", examples: ["2024-10-18 10:19:06"] }))),
    "status": Type.Optional(Nullable(PaymentRefundStatus)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Refund value", examples: [40] }))),
    "endToEndIdentifier": Type.Optional(Nullable(Type.String({ description: "(Pix only) Unique identifier of the Pix transaction at the Central Bank", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the refund", examples: [null] }))),
    "effectiveDate": Type.Optional(Nullable(Type.String({ description: "(Pix only) Refund effective date", examples: ["2024-10-19 10:19:06"] }))),
    "transactionReceiptUrl": Type.Optional(Nullable(Type.String({ description: "Transaction receipt link", examples: [null] }))),
    "refundedSplits": Type.Optional(Nullable(Type.Array(PaymentRefundedSplitResponse))),
    "paymentId": Type.Optional(Nullable(Type.String({ description: "Unique payment identifier in Asaas", examples: ["pay_080225913252"] }))),
  })
export type InstallmentRefundResponse = (typeof InstallmentRefundResponse)['static']

export const InstallmentGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["installment"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique installment identifier in Asaas", examples: ["2765d086-c7c5-5cca-898a-4262d212587c"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Installment amount", examples: [360] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net installment amount", examples: [312.12] }))),
    "paymentValue": Type.Optional(Nullable(Type.Number({ description: "Value of each installment", examples: [30] }))),
    "installmentCount": Type.Optional(Nullable(Type.Integer({ description: "Number of installments", examples: [12] }))),
    "billingType": Type.Optional(Nullable(PaymentGetResponseBillingType)),
    "paymentDate": Type.Optional(Nullable(Type.String({ description: "Bill settlement date on Asaas", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the installment", examples: ["Order 056984"] }))),
    "expirationDay": Type.Optional(Nullable(Type.Integer({ description: "Due date of each installment", examples: [31] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Installment creation date", examples: ["2021-01-19"] }))),
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the customer to whom the installment belongs", examples: ["cus_000000001645"] }))),
    "paymentLink": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment link to which the installment belongs", examples: ["997152082166122"] }))),
    "checkoutSession": Type.Optional(Nullable(Type.String({ description: "Unique checkout identifier", examples: ["5a3e564f-81cd-4f4e-9c8e-af43f9ac4287"] }))),
    "transactionReceiptUrl": Type.Optional(Nullable(Type.String({ description: "URL of proof of confirmation, receipt, reversal or removal.", examples: [null] }))),
    "chargeback": Type.Optional(Nullable(PaymentChargebackResponse)),
    "creditCard": Type.Optional(Nullable(PaymentSaveWithCreditCardCreditCard)),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the installment has been removed", examples: [false] }))),
    "refunds": Type.Optional(Nullable(Type.Array(InstallmentRefundResponse))),
  })
export type InstallmentGetResponse = (typeof InstallmentGetResponse)['static']

export const InstallmentListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(InstallmentGetResponse))),
  })
export type InstallmentListResponse = (typeof InstallmentListResponse)['static']

export const InstallmentRefundRequest = Type.Object({
    "value": Type.Optional(Nullable(Type.Number({ description: "Total amount to be refunded", examples: [5] }))),
  })
export type InstallmentRefundRequest = (typeof InstallmentRefundRequest)['static']

/** Split Settings */
export const InstallmentSplitRequest = Type.Object({
    "walletId": Type.String({ description: "Asaas wallet identifier that will be transferred", examples: [null] }),
    "fixedValue": Type.Optional(Nullable(Type.Number({ description: "Fixed amount to be transferred to the account when the payment is received", examples: [null] }))),
    "percentualValue": Type.Optional(Nullable(Type.Number({ description: "Percentage of the net value of the charge to be transferred when received", examples: [null] }))),
    "totalFixedValue": Type.Optional(Nullable(Type.Number({ description: "(Instalments only). Amount that will be split relative to the total amount that will be paid in installments.", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Split identifier in your system", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Split description", examples: [null] }))),
    "installmentNumber": Type.Optional(Nullable(Type.Integer({ description: "Installment number to which the split will be linked. Cannot be provided along with the 'totalFixedValue' field", examples: [null] }))),
  })
export type InstallmentSplitRequest = (typeof InstallmentSplitRequest)['static']

export const InstallmentSaveRequest = Type.Object({
    "installmentCount": Type.Integer({ description: "Number of installments", examples: [3] }),
    "customer": Type.String({ description: "Unique customer identifier in Asaas", examples: ["cus_G7Dvo4iphUNk"] }),
    "value": Type.Optional(Nullable(Type.Number({ description: "Value of each installment", examples: [100] }))),
    "totalValue": Type.Optional(Nullable(Type.Number({ description: "Total installment amount", examples: [150] }))),
    "billingType": BillingType,
    "dueDate": Type.String({ description: "Due date of the first installment", examples: ["2025-07-08"] }),
    "description": Type.Optional(Nullable(Type.String({ description: "Installment description (max. 500 characters)", examples: ["Installment 08652"] }))),
    "postalService": Type.Optional(Nullable(Type.Boolean({ description: "Define whether the payment will be sent via post", examples: [false] }))),
    "daysAfterDueDateToRegistrationCancellation": Type.Optional(Nullable(Type.Integer({ description: "Days after registration cancellation deadline (only for bank slip)", examples: [1] }))),
    "paymentExternalReference": Type.Optional(Nullable(Type.String({ description: "Free search field", examples: ["056984"] }))),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "interest": Type.Optional(Nullable(PaymentInterestRequest)),
    "fine": Type.Optional(Nullable(PaymentFineRequest)),
    "splits": Type.Optional(Nullable(Type.Array(InstallmentSplitRequest))),
  })
export type InstallmentSaveRequest = (typeof InstallmentSaveRequest)['static']

export const InstallmentSaveWithCreditCardRequest = Type.Object({
    "installmentCount": Type.Integer({ description: "Number of installments", examples: [3] }),
    "customer": Type.String({ description: "Unique customer identifier in Asaas", examples: ["cus_G7Dvo4iphUNk"] }),
    "value": Type.Optional(Nullable(Type.Number({ description: "Value of each installment", examples: [100] }))),
    "totalValue": Type.Optional(Nullable(Type.Number({ description: "Total installment amount", examples: [150] }))),
    "billingType": BillingType,
    "dueDate": Type.String({ description: "Due date of the first installment", examples: ["2025-07-08"] }),
    "description": Type.Optional(Nullable(Type.String({ description: "Installment description (max. 500 characters)", examples: ["Installment 08652"] }))),
    "postalService": Type.Optional(Nullable(Type.Boolean({ description: "Define whether the payment will be sent via post", examples: [false] }))),
    "daysAfterDueDateToRegistrationCancellation": Type.Optional(Nullable(Type.Integer({ description: "Days after registration cancellation deadline (only for bank slip)", examples: [1] }))),
    "paymentExternalReference": Type.Optional(Nullable(Type.String({ description: "Free search field", examples: ["056984"] }))),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "interest": Type.Optional(Nullable(PaymentInterestRequest)),
    "fine": Type.Optional(Nullable(PaymentFineRequest)),
    "splits": Type.Optional(Nullable(Type.Array(InstallmentSplitRequest))),
    "creditCard": CreditCardRequest,
    "creditCardHolderInfo": CreditCardHolderInfoRequest,
    "creditCardToken": Type.Optional(Nullable(Type.String({ description: "Credit card token for using the credit card tokenization functionality. If informed, the fields creditCard and creditCardHolderInfo are not mandatory.", examples: ["a75a1d98-c52d-4a6b-a413-71e00b193c99"] }))),
    "authorizeOnly": Type.Optional(Nullable(Type.Boolean({ description: "Carry out only the Pre-Authorization of the installment", examples: [null] }))),
    "remoteIp": Type.String({ description: "IP from where the customer is making the purchase. Your server's IP must not be entered.", examples: [null] }),
  })
export type InstallmentSaveWithCreditCardRequest = (typeof InstallmentSaveWithCreditCardRequest)['static']

/** Split array */
export const InstallmentSplitGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique split identifier in Asaas", examples: ["fd41396a-7453-47d0-9411-c8543522591d"] }))),
    "walletId": Type.Optional(Nullable(Type.String({ description: "Asaas wallet identifier that will be transferred", examples: ["7bafd95a-e783-4a62-9be1-23999af742c6"] }))),
    "fixedValue": Type.Optional(Nullable(Type.Number({ description: "Fixed amount to be transferred to the account when the charge is received", examples: [20.32] }))),
    "percentualValue": Type.Optional(Nullable(Type.Number({ description: "Percentage of the net value of the charge to be transferred when received", examples: [null] }))),
    "totalValue": Type.Optional(Nullable(Type.Number({ description: "Amount that will be split relative to the total amount that will be paid. The displayed values may be updated after the payment is confirmed or modified.", examples: [20.32] }))),
    "cancellationReason": Type.Optional(Nullable(PaymentSplitCancellationReason)),
    "status": Type.Optional(Nullable(PaymentSplitStatus)),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Unique identifier of split in your system", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Split description", examples: [null] }))),
    "installmentNumber": Type.Optional(Nullable(Type.Integer({ description: "Installment to which the split is linked", examples: [null] }))),
  })
export type InstallmentSplitGetResponse = (typeof InstallmentSplitGetResponse)['static']

export const InstallmentUpdateSplitRequest = Type.Object({
    "splits": Type.Optional(Nullable(Type.Array(InstallmentSplitRequest))),
  })
export type InstallmentUpdateSplitRequest = (typeof InstallmentUpdateSplitRequest)['static']

export const InstallmentUpdateSplitResponse = Type.Object({
    "splits": Type.Optional(Nullable(Type.Array(InstallmentSplitGetResponse))),
  })
export type InstallmentUpdateSplitResponse = (typeof InstallmentUpdateSplitResponse)['static']
