// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { BillingType, ChargeType, Cycle } from '../enums.ts'
import { File, PaymentCallbackRequest } from './common.ts'

export const PaymentLinkDeleteResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the payment link has been removed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique identifier for your payments link in Asaas", examples: ["725104409743"] }))),
  })
export type PaymentLinkDeleteResponse = (typeof PaymentLinkDeleteResponse)['static']

export const PaymentLinkFileDeleteResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the image was removed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique payment link image identifier in Asaas", examples: ["417d1fe7-f530-4368-935f-699045f2bf5d"] }))),
  })
export type PaymentLinkFileDeleteResponse = (typeof PaymentLinkFileDeleteResponse)['static']

/** Payments link image information */
export const PaymentLinkFileImageResponse = Type.Object({
    "originalName": Type.Optional(Nullable(Type.String({ description: "Original image name", examples: ["cover.png"] }))),
    "size": Type.Optional(Nullable(Type.Integer({ description: "Image size", examples: [50859] }))),
    "extension": Type.Optional(Nullable(Type.String({ description: "Image extension", examples: ["png"] }))),
    "previewUrl": Type.Optional(Nullable(Type.String({ description: "Link to download the image preview", examples: ["https://www.asaas.com/file/preview/XtW5OjqOBy3sskIcEMPj6yhr7T3aCLnSWEbIJd08gMNf3Rk7r5buwAXQ9xC2TNmg"] }))),
    "downloadUrl": Type.Optional(Nullable(Type.String({ description: "Link to download the image", examples: ["https://www.asaas.com/file/public/download/XtW5OjqOBy3sskIcEMPj6yhr7T3aCLnSWEbIJd08gMNf3Rk7r5buwAXQ9xC2TNmg"] }))),
  })
export type PaymentLinkFileImageResponse = (typeof PaymentLinkFileImageResponse)['static']

export const PaymentLinkFileGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique payment link image identifier in Asaas", examples: ["417d1fe7-f530-4368-935f-699045f2bf5d"] }))),
    "main": Type.Optional(Nullable(Type.Boolean({ description: "Determines if this is the main image", examples: [true] }))),
    "image": Type.Optional(Nullable(PaymentLinkFileImageResponse)),
  })
export type PaymentLinkFileGetResponse = (typeof PaymentLinkFileGetResponse)['static']

export const PaymentLinkFileListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentLinkFileGetResponse))),
  })
export type PaymentLinkFileListResponse = (typeof PaymentLinkFileListResponse)['static']

export const PaymentLinkFilePathIdRequest = Type.Object({})
export type PaymentLinkFilePathIdRequest = (typeof PaymentLinkFilePathIdRequest)['static']

export const PaymentLinkFileSaveRequest = Type.Object({
    "main": Type.Optional(Nullable(Type.Boolean({ description: "true to set as the main image", examples: [true] }))),
    "image": Type.Optional(Nullable(File)),
  })
export type PaymentLinkFileSaveRequest = (typeof PaymentLinkFileSaveRequest)['static']

export const PaymentLinkGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique identifier for your payments link in Asaas", examples: ["725104409743"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Payment link name", examples: ["Book sales"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Value of the payment link, if not informed, the payer can inform how much they want to pay", examples: [50] }))),
    "active": Type.Optional(Nullable(Type.Boolean({ description: "If the payments link is active", examples: [true] }))),
    "chargeType": Type.Optional(Nullable(ChargeType)),
    "url": Type.Optional(Nullable(Type.String({ description: "Payments link access link", examples: ["https://www.asaas.com/c/291089675759"] }))),
    "billingType": Type.Optional(Nullable(BillingType)),
    "subscriptionCycle": Type.Optional(Nullable(Cycle)),
    "description": Type.Optional(Nullable(Type.String({ description: "Payments link description", examples: ["Any book for just R$: 50.00"] }))),
    "endDate": Type.Optional(Nullable(Type.String({ description: "End date", examples: ["2024-09-05"] }))),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the payment link has been removed", examples: [false] }))),
    "viewCount": Type.Optional(Nullable(Type.Integer({ description: "The number of views of your payments link", examples: [0] }))),
    "maxInstallmentCount": Type.Optional(Nullable(Type.Integer({ description: "Maximum number of installments that your customer can pay in installments for the payment link, if it is Installment.", examples: [1] }))),
    "dueDateLimitDays": Type.Optional(Nullable(Type.Integer({ description: "Number of business days that your customer can pay after the invoice is generated (For payment method such as Boleto)", examples: [10] }))),
    "notificationEnabled": Type.Optional(Nullable(Type.Boolean({ description: "Defines whether customers registered via the payments link will have notifications enabled", examples: [true] }))),
    "isAddressRequired": Type.Optional(Nullable(Type.Boolean({ description: "Defines whether filling in the address will be obligatory in the charges.", examples: [true] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field.", examples: ["056984"] }))),
  })
export type PaymentLinkGetResponse = (typeof PaymentLinkGetResponse)['static']

export const PaymentLinkListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentLinkGetResponse))),
  })
export type PaymentLinkListResponse = (typeof PaymentLinkListResponse)['static']

export const PaymentLinkPathIdRequest = Type.Object({})
export type PaymentLinkPathIdRequest = (typeof PaymentLinkPathIdRequest)['static']

export const PaymentLinkSaveRequest = Type.Object({
    "name": Type.String({ description: "Payment link name", examples: ["Book sales"] }),
    "description": Type.Optional(Nullable(Type.String({ description: "Payments link description", examples: ["Any book for just R$: 50.00"] }))),
    "endDate": Type.Optional(Nullable(Type.String({ description: "End date", examples: ["2024-09-05"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Value of the payment link, if not informed, the payer can inform how much they want to pay", examples: [50] }))),
    "billingType": BillingType,
    "chargeType": ChargeType,
    "dueDateLimitDays": Type.Optional(Nullable(Type.Integer({ description: "Number of business days that your customer can pay after the invoice is generated (For payment method such as Boleto)", examples: [10] }))),
    "subscriptionCycle": Type.Optional(Nullable(Cycle)),
    "maxInstallmentCount": Type.Optional(Nullable(Type.Integer({ description: "Maximum number of installments that your customer can pay in installments for the payment link if the billing method selected is Installments. If not informed, the default value will be 1 installment", examples: [1] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field.", examples: ["1287"] }))),
    "notificationEnabled": Type.Optional(Nullable(Type.Boolean({ description: "Defines whether customers registered via the payments link will have notifications enabled. If not informed, the default value will be true", examples: [false] }))),
    "callback": Type.Optional(Nullable(PaymentCallbackRequest)),
    "isAddressRequired": Type.Optional(Nullable(Type.Boolean({ description: "True to make it mandatory to fill in address data at checkout.", examples: [true] }))),
  })
export type PaymentLinkSaveRequest = (typeof PaymentLinkSaveRequest)['static']

export const PaymentLinkUpdateRequest = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Payment link name", examples: ["Book sales"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Payments link description", examples: ["Any book for just R$: 50.00"] }))),
    "endDate": Type.Optional(Nullable(Type.String({ description: "End date", examples: ["2024-09-05"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Value of the payment link, if not informed, the payer can inform how much they want to pay", examples: [50] }))),
    "active": Type.Optional(Nullable(Type.Boolean({ description: "Determines whether the payments link is active", examples: [true] }))),
    "billingType": Type.Optional(Nullable(BillingType)),
    "chargeType": Type.Optional(Nullable(ChargeType)),
    "dueDateLimitDays": Type.Optional(Nullable(Type.Integer({ description: "Number of business days that your customer can pay after the invoice is generated (For payment method such as Boleto)", examples: [10] }))),
    "subscriptionCycle": Type.Optional(Nullable(Cycle)),
    "maxInstallmentCount": Type.Optional(Nullable(Type.Integer({ description: "Maximum number of installments that your customer can pay in installments for the payment link if the billing method selected is Installments. If not informed, the default value will be 1 installment", examples: [1] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field.", examples: ["2323"] }))),
    "notificationEnabled": Type.Optional(Nullable(Type.Boolean({ description: "Defines whether customers registered via the payments link will have notifications enabled. If not informed, the default value will be true", examples: [false] }))),
    "callback": Type.Optional(Nullable(PaymentCallbackRequest)),
  })
export type PaymentLinkUpdateRequest = (typeof PaymentLinkUpdateRequest)['static']
