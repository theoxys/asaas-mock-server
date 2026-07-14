// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { BankAccountType, PixAddressKeyType, PixRecurringTransactionFrequency, TransferSaveRequestTransferType, TransferStatus, TransferType } from '../enums.ts'

/** Bank account name */
export const TransferBankGetResponse = Type.Object({
    "ispb": Type.Optional(Nullable(Type.String({ description: "Identifier in the Brazilian Payment System", examples: [null] }))),
    "code": Type.Optional(Nullable(Type.String({ description: "Bank clearing code in the banking system", examples: ["001"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Bank name", examples: ["Banco do Brasil"] }))),
  })
export type TransferBankGetResponse = (typeof TransferBankGetResponse)['static']

/** Bank account details */
export const TransferBankAccountGetResponse = Type.Object({
    "bank": Type.Optional(Nullable(TransferBankGetResponse)),
    "accountName": Type.Optional(Nullable(Type.String({ description: "Name of bank account owner", examples: ["Banco do Brasil account"] }))),
    "ownerName": Type.Optional(Nullable(Type.String({ description: "Name of bank account owner", examples: ["John Doe"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the bank account owner", examples: ["***.143.689-**"] }))),
    "agency": Type.Optional(Nullable(Type.String({ description: "Non-digit agency number", examples: ["1263"] }))),
    "agencyDigit": Type.Optional(Nullable(Type.String({ description: "Agency digit", examples: ["3"] }))),
    "account": Type.Optional(Nullable(Type.String({ description: "Non-digit bank account number", examples: ["9999991"] }))),
    "accountDigit": Type.Optional(Nullable(Type.String({ description: "Bank account digit", examples: ["1"] }))),
    "pixAddressKey": Type.Optional(Nullable(Type.String({ description: "Pix key address", examples: [null] }))),
  })
export type TransferBankAccountGetResponse = (typeof TransferBankAccountGetResponse)['static']

/** Details of the bank account to which the transfer will be made */
export const TransferBankSaveRequest = Type.Object({
    "code": Type.String({ description: "Bank clearing code in the banking system", examples: ["237"] }),
  })
export type TransferBankSaveRequest = (typeof TransferBankSaveRequest)['static']

/** Enter your account details if it is a transfer to a bank account */
export const TransferBankAccountSaveRequest = Type.Object({
    "bank": Type.Optional(Nullable(TransferBankSaveRequest)),
    "accountName": Type.Optional(Nullable(Type.String({ description: "Bank account name", examples: ["Bradesco account"] }))),
    "ownerName": Type.String({ description: "Name of bank account owner", examples: ["John Doe"] }),
    "ownerBirthDate": Type.Optional(Nullable(Type.String({ description: "Account owner's date of birth. Only when the bank account does not belong to the same CPF or CNPJ as the Asaas account.", examples: ["1995-04-12"] }))),
    "cpfCnpj": Type.String({ description: "CPF or CNPJ of the bank account owner", examples: ["52233424611"] }),
    "agency": Type.String({ description: "Non-digit agency number", examples: ["1263"] }),
    "account": Type.String({ description: "Non-digit bank account number", examples: ["9999991"] }),
    "accountDigit": Type.String({ description: "Bank account digit", examples: ["1"] }),
    "bankAccountType": Type.Optional(Nullable(BankAccountType)),
    "ispb": Type.Optional(Nullable(Type.String({ description: "Identifier in the Brazilian Payment System", examples: ["60746948"] }))),
  })
export type TransferBankAccountSaveRequest = (typeof TransferBankAccountSaveRequest)['static']

export const TransferGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["transfer"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique transfer identifier in Asaas", examples: ["777eb7c8-b1a2-4356-8fd8-a1b0644b5282"] }))),
    "type": Type.Optional(Nullable(Type.Union([Type.Literal("PIX"), Type.Literal("TED"), Type.Literal("INTERNAL")]))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Transfer request date", examples: ["2019-05-02"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Transfer amount", examples: [1000] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net value minus transfer fee", examples: [0] }))),
    "status": Type.Optional(Nullable(TransferStatus)),
    "transferFee": Type.Optional(Nullable(Type.Number({ description: "Transfer rate", examples: [0] }))),
    "effectiveDate": Type.Optional(Nullable(Type.String({ description: "Effective date", examples: ["2019-05-02"] }))),
    "scheduleDate": Type.Optional(Nullable(Type.String({ description: "Schedule date", examples: ["2019-05-02"] }))),
    "endToEndIdentifier": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the Pix transaction at the Central Bank", examples: [null] }))),
    "authorized": Type.Optional(Nullable(Type.Boolean({ description: "`false` when awaiting authorization via SMS Token", examples: [true] }))),
    "failReason": Type.Optional(Nullable(Type.String({ description: "Reason for transfer failure", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Transfer identifier in your system", examples: [null] }))),
    "transactionReceiptUrl": Type.Optional(Nullable(Type.String({ description: "Proof of transfer will be available after the transfer is confirmed", examples: [null] }))),
    "operationType": Type.Optional(Nullable(TransferType)),
    "description": Type.Optional(Nullable(Type.String({ description: "Transfer description", examples: [null] }))),
    "recurring": Type.Optional(Nullable(Type.String({ description: "Unique recurrence identifier in Asaas", examples: [null] }))),
    "bankAccount": Type.Optional(Nullable(TransferBankAccountGetResponse)),
  })
export type TransferGetResponse = (typeof TransferGetResponse)['static']

export const TransferListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(TransferGetResponse))),
  })
export type TransferListResponse = (typeof TransferListResponse)['static']

/** Recurrence information. Only for Pix transfers */
export const TransferRecurringSaveRequest = Type.Object({
    "frequency": Type.Optional(Nullable(PixRecurringTransactionFrequency)),
    "quantity": Type.Optional(Nullable(Type.Integer({ description: "Number of repetitions. This transfer will be included as the first transaction of the recurrence.\n For the `WEEKLY` frequency, the maximum accepted is: `51`\n For the `MONTHLY` frequency, the maximum accepted is: `11`", examples: [3] }))),
  })
export type TransferRecurringSaveRequest = (typeof TransferRecurringSaveRequest)['static']

/** Target account basic information */
export const TransferSaveInternalTransferAccount = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Target account name", examples: ["John Doe"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the destination account", examples: ["***.143.689-**"] }))),
    "agency": Type.Optional(Nullable(Type.String({ description: "Target account branch code", examples: ["0001"] }))),
    "account": Type.Optional(Nullable(Type.String({ description: "Target account number", examples: ["2087"] }))),
    "accountDigit": Type.Optional(Nullable(Type.String({ description: "Target account digit", examples: ["2"] }))),
  })
export type TransferSaveInternalTransferAccount = (typeof TransferSaveInternalTransferAccount)['static']

export const TransferSaveInternalTransferRequest = Type.Object({
    "value": Type.Number({ description: "Amount to be transferred", examples: [1000] }),
    "walletId": Type.String({ description: "WalletId of the target account", examples: ["021c712-d963-4d86-a59d-031e7ac51a2e"] }),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Transfer identifier in your system", examples: [null] }))),
  })
export type TransferSaveInternalTransferRequest = (typeof TransferSaveInternalTransferRequest)['static']

export const TransferSaveInternalTransferResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["transfer"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique transfer identifier in Asaas", examples: ["777eb7c8-b1a2-4356-8fd8-a1b0644b5282"] }))),
    "type": Type.Optional(Nullable(Type.Union([Type.Literal("PIX"), Type.Literal("TED"), Type.Literal("INTERNAL")]))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Transfer request date", examples: ["2019-05-02"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Transfer amount", examples: [1000] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net value minus transfer fee", examples: [0] }))),
    "status": Type.Optional(Nullable(TransferStatus)),
    "transferFee": Type.Optional(Nullable(Type.Number({ description: "Transfer rate", examples: [0] }))),
    "effectiveDate": Type.Optional(Nullable(Type.String({ description: "Effective date", examples: ["2019-05-02"] }))),
    "scheduleDate": Type.Optional(Nullable(Type.String({ description: "Schedule date", examples: ["2019-05-02"] }))),
    "endToEndIdentifier": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the Pix transaction at the Central Bank", examples: [null] }))),
    "authorized": Type.Optional(Nullable(Type.Boolean({ description: "`false` when awaiting authorization via SMS Token", examples: [true] }))),
    "failReason": Type.Optional(Nullable(Type.String({ description: "Reason for transfer failure", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Transfer identifier in your system", examples: [null] }))),
    "transactionReceiptUrl": Type.Optional(Nullable(Type.String({ description: "Proof of transfer will be available after the transfer is confirmed", examples: [null] }))),
    "operationType": Type.Optional(Nullable(TransferType)),
    "description": Type.Optional(Nullable(Type.String({ description: "Transfer description", examples: [null] }))),
    "recurring": Type.Optional(Nullable(Type.String({ description: "Unique recurrence identifier in Asaas", examples: [null] }))),
    "walletId": Type.Optional(Nullable(Type.String({ description: "Unique wallet identifier to split charges or transfer between Asaas accounts", examples: [null] }))),
    "account": Type.Optional(Nullable(TransferSaveInternalTransferAccount)),
  })
export type TransferSaveInternalTransferResponse = (typeof TransferSaveInternalTransferResponse)['static']

export const TransferSaveRequest = Type.Object({
    "value": Type.Number({ description: "Amount to be transferred", examples: [1000] }),
    "bankAccount": Type.Optional(Nullable(TransferBankAccountSaveRequest)),
    "operationType": Type.Optional(Nullable(TransferSaveRequestTransferType)),
    "pixAddressKey": Type.Optional(Nullable(Type.String({ description: "Enter the Pix key if it is a transfer to a Pix key", examples: [null] }))),
    "pixAddressKeyType": Type.Optional(Nullable(PixAddressKeyType)),
    "description": Type.Optional(Nullable(Type.String({ description: "Transfers via Pix allow description", examples: ["Barbecue paid via Pix scheduled"] }))),
    "scheduleDate": Type.Optional(Nullable(Type.String({ description: "For scheduled transfers, if not informed, payment is instantaneous", examples: ["2018-01-26"] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Transfer identifier in your system", examples: [null] }))),
    "recurring": Type.Optional(Nullable(TransferRecurringSaveRequest)),
  })
export type TransferSaveRequest = (typeof TransferSaveRequest)['static']
