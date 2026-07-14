// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { PersonType, PixAddressKeyType, PixQrCodeDecodeReceiverPixAccountType, PixQrCodeType, PixTransactionCashValueFinality, PixTransactionOriginType, PixTransactionStatus, PixTransactionType } from '../enums.ts'

/** Original transaction information if a chargeback has occurred */
export const PixOriginalTransactionResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique transaction identifier", examples: [null] }))),
    "endToEndIdentifier": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the Pix transaction at the Central Bank", examples: [null] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Original transaction value", examples: [null] }))),
    "effectiveDate": Type.Optional(Nullable(Type.String({ description: "Transaction date", examples: [null] }))),
  })
export type PixOriginalTransactionResponse = (typeof PixOriginalTransactionResponse)['static']

/** Information about the receiver */
export const PixQrCodeDecodeReceiver = Type.Object({
    "ispb": Type.Optional(Nullable(Type.String({ description: "Financial institution code", examples: [null] }))),
    "ispbName": Type.Optional(Nullable(Type.String({ description: "Name of the financial institution", examples: [null] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Receiver name", examples: [null] }))),
    "tradingName": Type.Optional(Nullable(Type.String({ description: "Receiver's trade name", examples: [null] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the receiver", examples: [null] }))),
    "personType": Type.Optional(Nullable(PersonType)),
    "accountType": Type.Optional(Nullable(PixQrCodeDecodeReceiverPixAccountType)),
  })
export type PixQrCodeDecodeReceiver = (typeof PixQrCodeDecodeReceiver)['static']

export const PixQrCodeDecodeRequest = Type.Object({
    "payload": Type.String({ description: "QRCode payload", examples: ["00020101021226730014br.gov.bcb.pix2551pix-h.asaas.com/pixqrcode/cobv/pay_76575613967995145204000053039865802BR5905ASAAS6009Joinville61088922827162070503***63045E7A"] }),
    "changeValue": Type.Optional(Nullable(Type.Number({ description: "Change amount (for QRCode Change)", examples: [null] }))),
    "expectedPaymentDate": Type.Optional(Nullable(Type.String({ description: "Date when the payment is expected to be made", examples: ["2026-01-01"] }))),
  })
export type PixQrCodeDecodeRequest = (typeof PixQrCodeDecodeRequest)['static']

/** Information about the payer */
export const PixTransactionQrCodePayerResponse = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Payer's name", examples: ["Elon Musk"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the payer", examples: ["***.456.789-**"] }))),
  })
export type PixTransactionQrCodePayerResponse = (typeof PixTransactionQrCodePayerResponse)['static']

export const PixQrCodeDecodeResponse = Type.Object({
    "payload": Type.Optional(Nullable(Type.String({ description: "Copy and Paste of the QRCode", examples: ["00020101021226730014br.gov.bcb.pix2551pix-h.asaas.com/pixqrcode/cobv/pay_76575613967995145204000053039865802BR5905ASAAS6009Joinville61088922827162070503***63045E7A"] }))),
    "type": Type.Optional(Nullable(PixQrCodeType)),
    "transactionOriginType": Type.Optional(Nullable(PixTransactionOriginType)),
    "pixKey": Type.Optional(Nullable(Type.String({ description: "Pix key used", examples: ["f9560206-807f-4273-ad72-d9ba9ddd867b"] }))),
    "conciliationIdentifier": Type.Optional(Nullable(Type.String({ description: "Unique Pix reconciliation identifier with Asaas", examples: ["dcabae5bbfb6nffbb87c69388365648"] }))),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Due date", examples: ["2030-02-05"] }))),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "Expiration date", examples: ["030-02-10 11:00:00"] }))),
    "finality": Type.Optional(Nullable(PixTransactionCashValueFinality)),
    "value": Type.Optional(Nullable(Type.Number({ description: "QRCode Value", examples: [100] }))),
    "changeValue": Type.Optional(Nullable(Type.Number({ description: "Change value", examples: [2] }))),
    "interest": Type.Optional(Nullable(Type.Number({ description: "Interest value", examples: [1] }))),
    "fine": Type.Optional(Nullable(Type.Number({ description: "Fine value", examples: [3] }))),
    "discount": Type.Optional(Nullable(Type.Number({ description: "Discount value", examples: [5] }))),
    "totalValue": Type.Optional(Nullable(Type.Number({ description: "Total amount with fine, interest and discount applied", examples: [99] }))),
    "canBePaidWithDifferentValue": Type.Optional(Nullable(Type.Boolean({ description: "Informs if the QRCode can be paid with another amount", examples: [true] }))),
    "canBeModifyChangeValue": Type.Optional(Nullable(Type.Boolean({ description: "Informs whether the change can be paid with another amount", examples: [false] }))),
    "receiver": Type.Optional(Nullable(PixQrCodeDecodeReceiver)),
    "payer": Type.Optional(Nullable(PixTransactionQrCodePayerResponse)),
    "description": Type.Optional(Nullable(Type.String({ description: "Description provided during the creation of the QRCode", examples: [null] }))),
    "canBePaid": Type.Optional(Nullable(Type.Boolean({ description: "Informs if the QRCode can be paid", examples: [true] }))),
    "cannotBePaidReason": Type.Optional(Nullable(Type.String({ description: "Informs why QRCode cannot be paid", examples: [null] }))),
  })
export type PixQrCodeDecodeResponse = (typeof PixQrCodeDecodeResponse)['static']

export const PixTransactionCancelRequest = Type.Object({})
export type PixTransactionCancelRequest = (typeof PixTransactionCancelRequest)['static']

/** Information about the recipient */
export const PixTransactionExternalAccountResponse = Type.Object({
    "ispb": Type.Optional(Nullable(Type.String({ description: "Payment Institution Identifier", examples: ["416968"] }))),
    "ispbName": Type.Optional(Nullable(Type.String({ description: "Name of Payment Institution", examples: ["Example Bank S.A"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Receiver name", examples: ["John Doe"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the recipient", examples: ["***.456.789-**"] }))),
    "addressKey": Type.Optional(Nullable(Type.String({ description: "Pix Key", examples: ["12345678910"] }))),
    "addressKeyType": Type.Optional(Nullable(PixAddressKeyType)),
  })
export type PixTransactionExternalAccountResponse = (typeof PixTransactionExternalAccountResponse)['static']

/** Information about QrCode */
export const PixTransactionQrCodeResponse = Type.Object({
    "payer": Type.Optional(Nullable(PixTransactionQrCodePayerResponse)),
    "conciliationIdentifier": Type.Optional(Nullable(Type.String({ description: "Unique Pix reconciliation identifier with Asaas", examples: ["dcabae5bbfb6nffbb87c693883656483"] }))),
    "originalValue": Type.Optional(Nullable(Type.Number({ description: "Original transaction value", examples: [99] }))),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Due date", examples: ["2030-02-05"] }))),
    "interest": Type.Optional(Nullable(Type.Number({ description: "Interest value", examples: [1] }))),
    "fine": Type.Optional(Nullable(Type.Number({ description: "Fine value", examples: [3] }))),
    "discount": Type.Optional(Nullable(Type.Number({ description: "Discount amount", examples: [5] }))),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "Expiration date", examples: ["2030-02-10 11:00:00"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "QrCode Description", examples: ["Barbecue"] }))),
  })
export type PixTransactionQrCodeResponse = (typeof PixTransactionQrCodeResponse)['static']

export const PixTransactionGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the Pix transaction in Asaas", examples: ["35363f6e-93e2-11ec-b9d9-96f4053b1bd4"] }))),
    "endToEndIdentifier": Type.Optional(Nullable(Type.String({ description: "Pix transaction identifier at the Central Bank", examples: ["E00416968202111161635q5bk0brYk2C"] }))),
    "finality": Type.Optional(Nullable(PixTransactionCashValueFinality)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Transaction or Withdrawal Value", examples: [10] }))),
    "changeValue": Type.Optional(Nullable(Type.Number({ description: "Change value", examples: [null] }))),
    "refundedValue": Type.Optional(Nullable(Type.Number({ description: "Value reversed", examples: [0] }))),
    "effectiveDate": Type.Optional(Nullable(Type.String({ description: "Transaction date", examples: ["2022-01-13 10:49:59"] }))),
    "scheduledDate": Type.Optional(Nullable(Type.String({ description: "Schedule date", examples: ["2022-10-18"] }))),
    "status": Type.Optional(Nullable(PixTransactionStatus)),
    "type": Type.Optional(Nullable(PixTransactionType)),
    "originType": Type.Optional(Nullable(PixTransactionOriginType)),
    "conciliationIdentifier": Type.Optional(Nullable(Type.String({ description: "QrCode identifier linked to the transaction", examples: ["dcabae5bbfb6nffbb87c693883656483"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description about the transaction", examples: [null] }))),
    "transactionReceiptUrl": Type.Optional(Nullable(Type.String({ description: "Proof of transaction will be available after the transaction is confirmed.", examples: [null] }))),
    "refusalReason": Type.Optional(Nullable(Type.String({ description: "Reason why the transaction was declined", examples: [null] }))),
    "canBeCanceled": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the transaction can be canceled", examples: [true] }))),
    "originalTransaction": Type.Optional(Nullable(PixOriginalTransactionResponse)),
    "externalAccount": Type.Optional(Nullable(PixTransactionExternalAccountResponse)),
    "qrCode": Type.Optional(Nullable(PixTransactionQrCodeResponse)),
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique billing identifier", examples: ["pay_0491859546906926"] }))),
    "canBeRefunded": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the transaction can be refunded", examples: [true] }))),
    "refundDisabledReason": Type.Optional(Nullable(Type.String({ description: "Reason why the chargeback was disabled", examples: [null] }))),
    "chargedFeeValue": Type.Optional(Nullable(Type.Number({ description: "Debit or credit fee for the transaction", examples: [0.99] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Transaction creation date", examples: ["023-02-14 10:42:55"] }))),
    "addressKey": Type.Optional(Nullable(Type.String({ description: "Pix key when the transaction is a credit", examples: [null] }))),
    "addressKeyType": Type.Optional(Nullable(PixAddressKeyType)),
    "transferId": Type.Optional(Nullable(Type.String({ description: "Transfer identifier", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field", examples: [null] }))),
  })
export type PixTransactionGetResponse = (typeof PixTransactionGetResponse)['static']

export const PixTransactionListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PixTransactionGetResponse))),
  })
export type PixTransactionListResponse = (typeof PixTransactionListResponse)['static']

/** QRCode payload for payment */
export const PixTransactionQrCodeSaveRequest = Type.Object({
    "payload": Type.String({ description: "QRCode payload", examples: [null] }),
    "changeValue": Type.Optional(Nullable(Type.Number({ description: "Change amount (for QRCode Change)", examples: [null] }))),
  })
export type PixTransactionQrCodeSaveRequest = (typeof PixTransactionQrCodeSaveRequest)['static']

export const PixTransactionSaveRequest = Type.Object({
    "qrCode": PixTransactionQrCodeSaveRequest,
    "value": Type.Number({ description: "Value to be paid", examples: [100] }),
    "description": Type.Optional(Nullable(Type.String({ description: "Payment Description", examples: ["Barbecue"] }))),
    "scheduleDate": Type.Optional(Nullable(Type.String({ description: "Used to schedule payment", examples: ["2022-03-15"] }))),
  })
export type PixTransactionSaveRequest = (typeof PixTransactionSaveRequest)['static']
