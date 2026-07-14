// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { BillingType, Cycle, PaymentGetResponseBillingType, SubscriptionSplitDisabledReason, SubscriptionSplitStatus, SubscriptionStatus, SubscriptionUpdateRequestSubscriptionStatus } from '../enums.ts'
import { CreditCardHolderInfoRequest, CreditCardRequest, InvoiceTaxesRequest, InvoiceTaxesResponse, PaymentCallbackRequest, PaymentDiscount, PaymentFineRequest, PaymentFineResponse, PaymentInterestRequest, PaymentInterestResponse, PaymentSaveWithCreditCardCreditCard } from './common.ts'

export const SubscriptionConfigureInvoiceRequest = Type.Object({
    "municipalServiceId": Type.Optional(Nullable(Type.String({ description: "Unique municipal service identifier", examples: [null] }))),
    "municipalServiceCode": Type.Optional(Nullable(Type.String({ description: "Municipal Service Code", examples: ["1.01"] }))),
    "municipalServiceName": Type.Optional(Nullable(Type.String({ description: "Name of municipal service", examples: [null] }))),
    "updatePayment": Type.Optional(Nullable(Type.Boolean({ description: "Update the Payment amount with the invoice taxes already deducted.", examples: [false] }))),
    "deductions": Type.Optional(Nullable(Type.Number({ description: "Deductions. Deductions do not change the total value of the invoice, but they do change the ISS calculation basis.", examples: [55] }))),
    "effectiveDatePeriod": Type.Optional(Nullable(Type.Union([Type.Literal("ON_PAYMENT_CONFIRMATION"), Type.Literal("ON_PAYMENT_DUE_DATE"), Type.Literal("BEFORE_PAYMENT_DUE_DATE"), Type.Literal("ON_DUE_DATE_MONTH"), Type.Literal("ON_NEXT_MONTH")]))),
    "receivedOnly": Type.Optional(Nullable(Type.Boolean({ description: "Issue only for paid charges", examples: [null] }))),
    "daysBeforeDueDate": Type.Optional(Nullable(Type.Integer({ description: "Number of days before billing due date", examples: [null] }))),
    "observations": Type.Optional(Nullable(Type.String({ description: "Additional notes on the invoice", examples: ["Regarding March work"] }))),
    "taxes": InvoiceTaxesRequest,
  })
export type SubscriptionConfigureInvoiceRequest = (typeof SubscriptionConfigureInvoiceRequest)['static']

export const SubscriptionDeleteInvoiceConfigResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Informs if configurations have been removed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique subscription identifier in Asaas", examples: ["sub_VXJBYgP2u0eO"] }))),
  })
export type SubscriptionDeleteInvoiceConfigResponse = (typeof SubscriptionDeleteInvoiceConfigResponse)['static']

export const SubscriptionDeleteResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Informs if the subscription has been removed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique subscription identifier in Asaas", examples: ["sub_VXJBYgP2u0eO"] }))),
  })
export type SubscriptionDeleteResponse = (typeof SubscriptionDeleteResponse)['static']

/** Split information */
export const SubscriptionSplitResponse = Type.Object({
    "walletId": Type.Optional(Nullable(Type.String({ description: "Asaas wallet identifier that will be transferred", examples: ["7bafd95a-e783-4a62-9be1-23999af742c6"] }))),
    "fixedValue": Type.Optional(Nullable(Type.Number({ description: "Fixed amount to be transferred to the account when the payment is received", examples: [20.32] }))),
    "percentualValue": Type.Optional(Nullable(Type.Number({ description: "Percentage of the net value of the charge to be transferred when received", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Split identifier in your system", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Split description", examples: [null] }))),
    "status": Type.Optional(Nullable(SubscriptionSplitStatus)),
    "disabledReason": Type.Optional(Nullable(SubscriptionSplitDisabledReason)),
  })
export type SubscriptionSplitResponse = (typeof SubscriptionSplitResponse)['static']

export const SubscriptionGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["subscription"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique subscription identifier in Asaas", examples: ["sub_VXJBYgP2u0eO"] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Subscription creation date", examples: ["2017-03-17"] }))),
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier", examples: ["cus_0T1mdomVMi39"] }))),
    "paymentLink": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payments link to which the subscription belongs", examples: [null] }))),
    "billingType": Type.Optional(Nullable(PaymentGetResponseBillingType)),
    "cycle": Type.Optional(Nullable(Cycle)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Subscription value", examples: [19.9] }))),
    "nextDueDate": Type.Optional(Nullable(Type.String({ description: "Due date of the next payment to be generated", examples: ["2017-06-15"] }))),
    "endDate": Type.Optional(Nullable(Type.String({ description: "Deadline for payments to be due", examples: ["2018-06-15"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Subscription description", examples: ["Pro Plan Subscription"] }))),
    "status": Type.Optional(Nullable(SubscriptionStatus)),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "fine": Type.Optional(Nullable(PaymentFineResponse)),
    "interest": Type.Optional(Nullable(PaymentInterestResponse)),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Informs if the subscription has been removed", examples: [false] }))),
    "maxPayments": Type.Optional(Nullable(Type.Integer({ description: "Maximum number of payments to be generated for this subscription", examples: [12] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Subscription identifier on your system", examples: [null] }))),
    "checkoutSession": Type.Optional(Nullable(Type.String({ description: "Unique checkout identifier", examples: ["356eb0c4-9eb7-4b7f-b2be-d9479af1d29f"] }))),
    "split": Type.Optional(Nullable(Type.Array(SubscriptionSplitResponse))),
  })
export type SubscriptionGetResponse = (typeof SubscriptionGetResponse)['static']

export const SubscriptionInvoiceConfigGetResponse = Type.Object({
    "municipalServiceId": Type.Optional(Nullable(Type.String({ description: "Unique municipal service identifier", examples: [null] }))),
    "municipalServiceCode": Type.Optional(Nullable(Type.String({ description: "Municipal Service Code", examples: ["1.01"] }))),
    "municipalServiceName": Type.Optional(Nullable(Type.String({ description: "Name of municipal service", examples: [null] }))),
    "deductions": Type.Optional(Nullable(Type.Number({ description: "Deductions. Deductions do not change the total value of the invoice, but they do change the ISS calculation basis.", examples: [55] }))),
    "invoiceCreationPeriod": Type.Optional(Nullable(Type.Union([Type.Literal("ON_PAYMENT_CONFIRMATION"), Type.Literal("ON_PAYMENT_DUE_DATE"), Type.Literal("BEFORE_PAYMENT_DUE_DATE"), Type.Literal("ON_DUE_DATE_MONTH"), Type.Literal("ON_NEXT_MONTH")]))),
    "daysBeforeDueDate": Type.Optional(Nullable(Type.Integer({ description: "Number of days before billing due date", examples: [null] }))),
    "receivedOnly": Type.Optional(Nullable(Type.Boolean({ description: "Issue only for paid charges", examples: [null] }))),
    "observations": Type.Optional(Nullable(Type.String({ description: "Additional notes on the invoice", examples: ["Regarding March work"] }))),
    "taxes": Type.Optional(Nullable(InvoiceTaxesResponse)),
  })
export type SubscriptionInvoiceConfigGetResponse = (typeof SubscriptionInvoiceConfigGetResponse)['static']

export const SubscriptionInvoiceConfigUpdateRequest = Type.Object({
    "deductions": Type.Optional(Nullable(Type.Number({ description: "Deductions. Deductions do not change the total value of the invoice, but they do change the ISS calculation basis.", examples: [55] }))),
    "effectiveDatePeriod": Type.Optional(Nullable(Type.Union([Type.Literal("ON_PAYMENT_CONFIRMATION"), Type.Literal("ON_PAYMENT_DUE_DATE"), Type.Literal("BEFORE_PAYMENT_DUE_DATE"), Type.Literal("ON_DUE_DATE_MONTH"), Type.Literal("ON_NEXT_MONTH")]))),
    "receivedOnly": Type.Optional(Nullable(Type.Boolean({ description: "Issue only for paid charges", examples: [null] }))),
    "daysBeforeDueDate": Type.Optional(Nullable(Type.Integer({ description: "Number of days before billing due date", examples: [null] }))),
    "observations": Type.Optional(Nullable(Type.String({ description: "Additional notes on the invoice", examples: ["Regarding March work"] }))),
    "taxes": InvoiceTaxesRequest,
  })
export type SubscriptionInvoiceConfigUpdateRequest = (typeof SubscriptionInvoiceConfigUpdateRequest)['static']

export const SubscriptionListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(SubscriptionGetResponse))),
  })
export type SubscriptionListResponse = (typeof SubscriptionListResponse)['static']

/** Split information */
export const SubscriptionSplitRequest = Type.Object({
    "walletId": Type.String({ description: "Asaas wallet identifier that will be transferred", examples: [null] }),
    "fixedValue": Type.Optional(Nullable(Type.Number({ description: "Fixed amount to be transferred to the account when the payment is received", examples: [null] }))),
    "percentualValue": Type.Optional(Nullable(Type.Number({ description: "Percentage of the net value of the charge to be transferred when received", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Split identifier in your system", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Split description", examples: [null] }))),
  })
export type SubscriptionSplitRequest = (typeof SubscriptionSplitRequest)['static']

export const SubscriptionSaveRequest = Type.Object({
    "customer": Type.String({ description: "Unique customer identifier in Asaas", examples: ["cus_0T1mdomVMi39"] }),
    "billingType": BillingType,
    "value": Type.Number({ description: "Subscription value", examples: [19.9] }),
    "nextDueDate": Type.String({ description: "First payment due", examples: ["2017-05-15"] }),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "interest": Type.Optional(Nullable(PaymentInterestRequest)),
    "fine": Type.Optional(Nullable(PaymentFineRequest)),
    "cycle": Cycle,
    "description": Type.Optional(Nullable(Type.String({ description: "Subscription description (max. 500 characters)", examples: ["Pro Plan Subscription"] }))),
    "endDate": Type.Optional(Nullable(Type.String({ description: "Deadline for payments to be due", examples: [null] }))),
    "maxPayments": Type.Optional(Nullable(Type.Integer({ description: "Maximum number of payments to be generated for this subscription", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Subscription identifier on your system", examples: [null] }))),
    "split": Type.Optional(Nullable(Type.Array(SubscriptionSplitRequest))),
    "callback": Type.Optional(Nullable(PaymentCallbackRequest)),
  })
export type SubscriptionSaveRequest = (typeof SubscriptionSaveRequest)['static']

export const SubscriptionSaveWithCreditCardRequest = Type.Object({
    "customer": Type.String({ description: "Unique customer identifier in Asaas", examples: ["cus_0T1mdomVMi39"] }),
    "billingType": BillingType,
    "value": Type.Number({ description: "Subscription value", examples: [19.9] }),
    "nextDueDate": Type.String({ description: "First payment due", examples: ["2017-05-15"] }),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "interest": Type.Optional(Nullable(PaymentInterestRequest)),
    "fine": Type.Optional(Nullable(PaymentFineRequest)),
    "cycle": Cycle,
    "description": Type.Optional(Nullable(Type.String({ description: "Subscription description (max. 500 characters)", examples: ["Pro Plan Subscription"] }))),
    "endDate": Type.Optional(Nullable(Type.String({ description: "Deadline for payments to be due", examples: [null] }))),
    "maxPayments": Type.Optional(Nullable(Type.Integer({ description: "Maximum number of payments to be generated for this subscription", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Subscription identifier on your system", examples: [null] }))),
    "split": Type.Optional(Nullable(Type.Array(SubscriptionSplitRequest))),
    "callback": Type.Optional(Nullable(PaymentCallbackRequest)),
    "creditCard": CreditCardRequest,
    "creditCardHolderInfo": CreditCardHolderInfoRequest,
    "creditCardToken": Type.Optional(Nullable(Type.String({ description: "Credit card token for using the credit card tokenization functionality. If informed, the fields above are not mandatory.", examples: ["a75a1d98-c52d-4a6b-a413-71e00b193c99"] }))),
    "remoteIp": Type.String({ description: "IP from where the customer is making the purchase. Your server's IP must not be entered.", examples: [null] }),
  })
export type SubscriptionSaveWithCreditCardRequest = (typeof SubscriptionSaveWithCreditCardRequest)['static']

export const SubscriptionSaveWithCreditCardResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["subscription"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique subscription identifier in Asaas", examples: ["sub_VXJBYgP2u0eO"] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Subscription creation date", examples: ["2017-03-17"] }))),
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier", examples: ["cus_0T1mdomVMi39"] }))),
    "paymentLink": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payments link to which the subscription belongs", examples: [null] }))),
    "billingType": Type.Optional(Nullable(PaymentGetResponseBillingType)),
    "cycle": Type.Optional(Nullable(Cycle)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Subscription value", examples: [19.9] }))),
    "nextDueDate": Type.Optional(Nullable(Type.String({ description: "Due date of the next payment to be generated", examples: ["2017-06-15"] }))),
    "endDate": Type.Optional(Nullable(Type.String({ description: "Deadline for payments to be due", examples: ["2018-06-15"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Subscription description", examples: ["Pro Plan Subscription"] }))),
    "status": Type.Optional(Nullable(SubscriptionStatus)),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "fine": Type.Optional(Nullable(PaymentFineResponse)),
    "interest": Type.Optional(Nullable(PaymentInterestResponse)),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Informs if the subscription has been removed", examples: [false] }))),
    "maxPayments": Type.Optional(Nullable(Type.Integer({ description: "Maximum number of payments to be generated for this subscription", examples: [12] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Subscription identifier on your system", examples: [null] }))),
    "checkoutSession": Type.Optional(Nullable(Type.String({ description: "Unique checkout identifier", examples: ["356eb0c4-9eb7-4b7f-b2be-d9479af1d29f"] }))),
    "split": Type.Optional(Nullable(Type.Array(SubscriptionSplitResponse))),
    "creditCard": Type.Optional(Nullable(PaymentSaveWithCreditCardCreditCard)),
  })
export type SubscriptionSaveWithCreditCardResponse = (typeof SubscriptionSaveWithCreditCardResponse)['static']

export const SubscriptionUpdateCreditCardRequest = Type.Object({
    "creditCard": CreditCardRequest,
    "creditCardHolderInfo": CreditCardHolderInfoRequest,
    "creditCardToken": Type.Optional(Nullable(Type.String({ description: "Credit card token for using the credit card tokenization functionality. If informed, the fields above are not mandatory.", examples: ["a75a1d98-c52d-4a6b-a413-71e00b193c99"] }))),
    "remoteIp": Type.String({ description: "IP from where the customer is making the purchase. Your server's IP must not be entered.", examples: ["116.213.42.532"] }),
  })
export type SubscriptionUpdateCreditCardRequest = (typeof SubscriptionUpdateCreditCardRequest)['static']

export const SubscriptionUpdateRequest = Type.Object({
    "billingType": Type.Optional(Nullable(BillingType)),
    "status": Type.Optional(Nullable(SubscriptionUpdateRequestSubscriptionStatus)),
    "nextDueDate": Type.Optional(Nullable(Type.String({ description: "First payment due", examples: ["2017-05-15"] }))),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "interest": Type.Optional(Nullable(PaymentInterestRequest)),
    "fine": Type.Optional(Nullable(PaymentFineRequest)),
    "cycle": Type.Optional(Nullable(Cycle)),
    "description": Type.Optional(Nullable(Type.String({ description: "Subscription description (max. 500 characters)", examples: ["Pro Plan Subscription"] }))),
    "endDate": Type.Optional(Nullable(Type.String({ description: "Deadline for payments to be due", examples: [null] }))),
    "updatePendingPayments": Type.Optional(Nullable(Type.Boolean({ description: "true to update the possible properties of already existing pending payments", examples: [true] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Subscription identifier on your system", examples: [null] }))),
    "split": Type.Optional(Nullable(Type.Array(SubscriptionSplitRequest))),
    "callback": Type.Optional(Nullable(PaymentCallbackRequest)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Subscription value", examples: [19.9] }))),
  })
export type SubscriptionUpdateRequest = (typeof SubscriptionUpdateRequest)['static']
