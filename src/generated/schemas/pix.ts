// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { PixAddressKeySaveRequestPixAddressKeyType, PixAddressKeyStatus, PixAddressKeyType } from '../enums.ts'

/** Bank data */
export const PixAddressKeyExternalGetBank = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["bank"] }))),
    "id": Type.Optional(Nullable(Type.Integer({ description: "Bank identifier", examples: [53] }))),
    "code": Type.Optional(Nullable(Type.String({ description: "Bank code", examples: ["461"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Bank name", examples: ["Asaas I.P S.A"] }))),
  })
export type PixAddressKeyExternalGetBank = (typeof PixAddressKeyExternalGetBank)['static']

/** Financial institution data */
export const PixAddressKeyExternalGetFinancialInstitution = Type.Object({
    "id": Type.Optional(Nullable(Type.Integer({ description: "Financial institution identifier", examples: [458] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Financial institution name", examples: ["ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTO S.A."] }))),
    "code": Type.Optional(Nullable(Type.String({ description: "Financial institution code", examples: ["461"] }))),
    "bank": Type.Optional(Nullable(PixAddressKeyExternalGetBank)),
  })
export type PixAddressKeyExternalGetFinancialInstitution = (typeof PixAddressKeyExternalGetFinancialInstitution)['static']

/** Key owner data */
export const PixAddressKeyExternalGetOwner = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Owner full name", examples: ["João Silva"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "Owner CPF or CNPJ", examples: ["***.202.745-**"] }))),
  })
export type PixAddressKeyExternalGetOwner = (typeof PixAddressKeyExternalGetOwner)['static']

export const PixAddressKeyExternalGetResponse = Type.Object({
    "type": Type.Optional(Nullable(Type.String({ description: "Pix Key type", examples: ["PHONE"] }))),
    "key": Type.Optional(Nullable(Type.String({ description: "Pix Key value", examples: ["+5547996515839"] }))),
    "ispb": Type.Optional(Nullable(Type.String({ description: "Identifier in the Brazilian Payment System", examples: ["19540550"] }))),
    "ispbName": Type.Optional(Nullable(Type.String({ description: "Payment institution name", examples: ["ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTO S.A."] }))),
    "financialInstitution": Type.Optional(Nullable(PixAddressKeyExternalGetFinancialInstitution)),
    "owner": Type.Optional(Nullable(PixAddressKeyExternalGetOwner)),
  })
export type PixAddressKeyExternalGetResponse = (typeof PixAddressKeyExternalGetResponse)['static']

/** Pix key QRCode */
export const PixAddressKeyQrCodeGetResponse = Type.Object({
    "encodedImage": Type.Optional(Nullable(Type.String({ description: "QrCode image in base64", examples: ["QRCODE IMAGE IN BASE64"] }))),
    "payload": Type.Optional(Nullable(Type.String({ description: "Copy and Paste the QrCode", examples: ["00020126580014br.gov.bcb.pix0136a9fe43bc-164d-44d1-91c2-2f9b4d6956e95204000053039865802BR5925Joao da Silva6009Joinville62290525JOAOSILVA00000055ASA6304E62B"] }))),
  })
export type PixAddressKeyQrCodeGetResponse = (typeof PixAddressKeyQrCodeGetResponse)['static']

export const PixAddressKeyGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique Pix key identifier in Asaas", examples: ["a33047b1-fb19-4b68-9373-a7ba8a8162aa"] }))),
    "key": Type.Optional(Nullable(Type.String({ description: "Key value", examples: ["b6295ee1-f054-47d1-9e90-ee57b74f60d9"] }))),
    "type": Type.Optional(Nullable(PixAddressKeyType)),
    "status": Type.Optional(Nullable(PixAddressKeyStatus)),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Key creation date", examples: ["2022-02-07 17:17:48"] }))),
    "canBeDeleted": Type.Optional(Nullable(Type.Boolean({ description: "Determines whether the key can be deleted", examples: [true] }))),
    "cannotBeDeletedReason": Type.Optional(Nullable(Type.String({ description: "Reason it cannot be removed", examples: [null] }))),
    "qrCode": Type.Optional(Nullable(PixAddressKeyQrCodeGetResponse)),
  })
export type PixAddressKeyGetResponse = (typeof PixAddressKeyGetResponse)['static']

export const PixAddressKeyListResponse = Type.Object({
    "data": Type.Optional(Nullable(Type.Array(PixAddressKeyGetResponse))),
  })
export type PixAddressKeyListResponse = (typeof PixAddressKeyListResponse)['static']

export const PixAddressKeySaveRequest = Type.Object({
    "type": PixAddressKeySaveRequestPixAddressKeyType,
  })
export type PixAddressKeySaveRequest = (typeof PixAddressKeySaveRequest)['static']

export const PixQrCodeDeleteResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "QR Code identifier", examples: ["ASAAS00000000000000383ASA"] }))),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the QR Code has been removed", examples: [true] }))),
  })
export type PixQrCodeDeleteResponse = (typeof PixQrCodeDeleteResponse)['static']

export const PixQrCodeSaveRequest = Type.Object({
    "addressKey": Type.Optional(Nullable(Type.String({ description: "Key that will receive QrCode payments", examples: ["b6295ee1-f054-47d1-9e90-ee57b74f60d9"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "QrCode Description", examples: ["Barbecue"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Value of the QrCode, if not informed, the payer can choose the value", examples: [50] }))),
    "format": Type.Optional(Nullable(Type.Union([Type.Literal("ALL"), Type.Literal("IMAGE"), Type.Literal("PAYLOAD")]))),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "QrCode expiration date/time, after this date all payments will be refused.", examples: ["2023-05-05 14:20:50"] }))),
    "expirationSeconds": Type.Optional(Nullable(Type.Integer({ description: "Determines the expiration date in seconds.", examples: [null] }))),
    "allowsMultiplePayments": Type.Optional(Nullable(Type.Boolean({ description: "Defines whether the QrCode can be paid multiple times, if not entered the default value is true.", examples: [true] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field", examples: [null] }))),
  })
export type PixQrCodeSaveRequest = (typeof PixQrCodeSaveRequest)['static']

export const PixQrCodeSaveResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "qrCode image in base64", examples: ["9bea9bcd126b45c7939960f577be84d6"] }))),
    "encodedImage": Type.Optional(Nullable(Type.String({ description: "QrCode identifier", examples: ["QRCODE IMAGE IN BASE64"] }))),
    "payload": Type.Optional(Nullable(Type.String({ description: "Copy and Paste the QrCode", examples: ["00020126580014br.gov.bcb.pix0136a9fe43bc-164d-44d1-91c2-2f9b4d6956e95204000053039865802BR5925Churrasco6009Joinville62290525JOAOSILVA00000055ASA6304E62B"] }))),
    "allowsMultiplePayments": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether multiple payments are allowed", examples: [true] }))),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "QrCode expiration date/time, after this date all payments will be refused", examples: ["2023-05-05 14:20:5"] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "QrCode Description", examples: ["Barbecue"] }))),
  })
export type PixQrCodeSaveResponse = (typeof PixQrCodeSaveResponse)['static']

export const PixTokenBucketGetAddressKeyResponse = Type.Object({
    "capacity": Type.Optional(Nullable(Type.Integer({ description: "Maximum token capacity", examples: [null] }))),
    "remaining": Type.Optional(Nullable(Type.Integer({ description: "Available tokens", examples: [null] }))),
  })
export type PixTokenBucketGetAddressKeyResponse = (typeof PixTokenBucketGetAddressKeyResponse)['static']
