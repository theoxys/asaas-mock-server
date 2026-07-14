// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { ChargeType, CheckoutSessionResponseBillingType, CheckoutSessionStatus, Cycle } from '../enums.ts'

/** Automatic redirection information after payment on the checkout screen */
export const CheckoutSessionCallback = Type.Object({
    "successUrl": Type.String({ description: "Redirect URL for successful checkout", examples: ["https://example.com/asaas/checkout/success"] }),
    "cancelUrl": Type.String({ description: "Redirect URL for canceled checkout", examples: ["https://example.com/asaas/checkout/cancel"] }),
    "expiredUrl": Type.Optional(Nullable(Type.String({ description: "Redirect URL for expired checkout", examples: ["https://example.com/asaas/checkout/expired"] }))),
  })
export type CheckoutSessionCallback = (typeof CheckoutSessionCallback)['static']

export const CheckoutSessionCancelRequest = Type.Object({})
export type CheckoutSessionCancelRequest = (typeof CheckoutSessionCancelRequest)['static']

/** Customer data */
export const CheckoutSessionCustomerData = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Customer name", examples: ["John Doe"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "Customer CPF or CNPJ", examples: ["24971563792"] }))),
    "email": Type.Optional(Nullable(Type.String({ description: "Customer email", examples: ["john.doe@asaas.com.br"] }))),
    "phone": Type.Optional(Nullable(Type.String({ description: "Customer phone", examples: ["4738010919"] }))),
    "address": Type.Optional(Nullable(Type.String({ description: "Customer address", examples: ["Av. Paulista"] }))),
    "addressNumber": Type.Optional(Nullable(Type.Integer({ description: "Address number", examples: ["150"] }))),
    "complement": Type.Optional(Nullable(Type.String({ description: "Address complement (max. 255 characters)", examples: ["Sala 201"] }))),
    "province": Type.Optional(Nullable(Type.String({ description: "Province of address", examples: ["Centro"] }))),
    "postalCode": Type.Optional(Nullable(Type.String({ description: "Address zip code", examples: ["01310-000"] }))),
    "city": Type.Optional(Nullable(Type.Integer({ description: "City code", examples: ["12987382"] }))),
  })
export type CheckoutSessionCustomerData = (typeof CheckoutSessionCustomerData)['static']

/** Installment details. If informed, it will be mandatory to include the `INSTALLMENT` chargeType */
export const CheckoutSessionInstallment = Type.Object({
    "maxInstallmentCount": Type.Optional(Nullable(Type.Integer({ description: "Maximum number of installments", examples: [1] }))),
  })
export type CheckoutSessionInstallment = (typeof CheckoutSessionInstallment)['static']

/** List of items at checkout */
export const CheckoutSessionItems = Type.Object({
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Item unique identifier in your system", examples: ["1addc353-9a05-4c39-81bb-758156fc942b"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Item Description", examples: ["Camisetas"] }))),
    "imageBase64": Type.String({ description: "Item image in Base64", examples: ["IMAGE IN BASE64"] }),
    "name": Type.String({ description: "Item name", examples: ["Roupas"] }),
    "quantity": Type.Integer({ description: "Item Quantity", examples: [2] }),
    "value": Type.Number({ description: "Item value", examples: [100] }),
  })
export type CheckoutSessionItems = (typeof CheckoutSessionItems)['static']

/** Subscription details, required if chargeTypes includes `RECURRENT` */
export const CheckoutSessionSubscription = Type.Object({
    "cycle": Type.Optional(Nullable(Cycle)),
    "endDate": Type.Optional(Nullable(Type.String({ description: "Deadline for payments to be due", examples: ["2025-01-01"] }))),
    "nextDueDate": Type.Optional(Nullable(Type.String({ description: "Due date of the next payment to be generated", examples: ["2025-01-01"] }))),
  })
export type CheckoutSessionSubscription = (typeof CheckoutSessionSubscription)['static']

/** Split Settings */
export const CheckoutSessionSplit = Type.Object({
    "walletId": Type.String({ description: "Asaas wallet identifier that will receive the transfer", examples: ["7bafd95a-e783-4a62-9be1-23999af742c6"] }),
    "fixedValue": Type.Optional(Nullable(Type.Number({ description: "Fixed amount to be transferred to the account when the payment is received", examples: ["Comissão referente ao serviço utilizado"] }))),
    "percentageValue": Type.Optional(Nullable(Type.Number({ description: "Percentage of the net value of the charge to be transferred when received", examples: [10] }))),
    "totalFixedValue": Type.Optional(Nullable(Type.Number({ description: "(Instalments only). Amount that will be split relative to the total amount that will be paid in installments.", examples: [15] }))),
  })
export type CheckoutSessionSplit = (typeof CheckoutSessionSplit)['static']

export const CheckoutSessionResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique identifier of checkout in Asaas", examples: ["131ca662-56c8-4479-b5b3-fd61a413fce7"] }))),
    "link": Type.Optional(Nullable(Type.String({ description: "Checkout access link", examples: ["https://sandbox.asaas.com/checkoutSession/show/131ca662-56c8-4479-b5b3-fd61a413fce7"] }))),
    "status": Type.Optional(Nullable(CheckoutSessionStatus)),
    "billingTypes": Type.Optional(Nullable(Type.Array(CheckoutSessionResponseBillingType))),
    "chargeTypes": Type.Optional(Nullable(Type.Array(ChargeType))),
    "minutesToExpire": Type.Optional(Nullable(Type.Integer({ description: "Time in minutes for checkout expiration", examples: [100] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Checkout identifier in your system", examples: ["dcf4dff9-b080-425c-b234-765f2ffac0ae"] }))),
    "callback": Type.Optional(Nullable(CheckoutSessionCallback)),
    "items": Type.Optional(Nullable(Type.Array(CheckoutSessionItems))),
    "customerData": Type.Optional(Nullable(CheckoutSessionCustomerData)),
    "subscription": Type.Optional(Nullable(CheckoutSessionSubscription)),
    "installment": Type.Optional(Nullable(CheckoutSessionInstallment)),
    "split": Type.Optional(Nullable(Type.Array(CheckoutSessionSplit))),
  })
export type CheckoutSessionResponse = (typeof CheckoutSessionResponse)['static']

export const CheckoutSessionSaveRequest = Type.Object({
    "billingTypes": Type.Array(CheckoutSessionResponseBillingType),
    "chargeTypes": Type.Array(ChargeType),
    "minutesToExpire": Type.Optional(Nullable(Type.Integer({ description: "Time in minutes for checkout expiration", examples: [10] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Checkout identifier in your system", examples: ["dcf4dff9-b080-425c-b234-765f2ffac0ae"] }))),
    "callback": CheckoutSessionCallback,
    "items": Type.Array(CheckoutSessionItems),
    "customerData": Type.Optional(Nullable(CheckoutSessionCustomerData)),
    "subscription": Type.Optional(Nullable(CheckoutSessionSubscription)),
    "installment": Type.Optional(Nullable(CheckoutSessionInstallment)),
    "splits": Type.Optional(Nullable(Type.Array(CheckoutSessionSplit))),
  })
export type CheckoutSessionSaveRequest = (typeof CheckoutSessionSaveRequest)['static']
