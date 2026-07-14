// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { AccountInfoCityState, CompanyType, InvoiceConfigStatus, PersonType, Status } from '../enums.ts'
import { AccountInfoCommercialInfoExpirationResponse, File } from './common.ts'

/** City information registered in your account */
export const AccountInfoCity = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["city"] }))),
    "id": Type.Optional(Nullable(Type.Integer({ description: "Unique city identifier in Asaas", examples: [13660] }))),
    "ibgeCode": Type.Optional(Nullable(Type.String({ description: "IBGE Code", examples: ["4209102"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "City's name", examples: ["Joinville"] }))),
    "districtCode": Type.Optional(Nullable(Type.String({ description: "District code", examples: ["05"] }))),
    "district": Type.Optional(Nullable(Type.String({ description: "District name", examples: ["Joinville"] }))),
    "state": Type.Optional(Nullable(AccountInfoCityState)),
  })
export type AccountInfoCity = (typeof AccountInfoCity)['static']

export const AccountInfoGetResponse = Type.Object({
    "status": Type.Optional(Nullable(Status)),
    "personType": Type.Optional(Nullable(PersonType)),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the account owner", examples: ["66625514000140"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Account owner name", examples: ["John Doe"] }))),
    "birthDate": Type.Optional(Nullable(Type.String({ description: "Birthday (Required if the information is from an individual)", examples: ["1995-04-12"] }))),
    "companyName": Type.Optional(Nullable(Type.String({ description: "Company Name", examples: [null] }))),
    "companyType": Type.Optional(Nullable(CompanyType)),
    "incomeValue": Type.Optional(Nullable(Type.Number({ description: "Billing/Monthly income", examples: [250000] }))),
    "email": Type.Optional(Nullable(Type.String({ description: "Account's email", examples: ["john.doe@asaas.com.br"] }))),
    "phone": Type.Optional(Nullable(Type.String({ description: "Telephone", examples: [null] }))),
    "mobilePhone": Type.Optional(Nullable(Type.String({ description: "Cell phone", examples: [null] }))),
    "postalCode": Type.Optional(Nullable(Type.String({ description: "Address zip code", examples: ["89223005"] }))),
    "address": Type.Optional(Nullable(Type.String({ description: "Public place", examples: ["Av. Rolf Wiest"] }))),
    "addressNumber": Type.Optional(Nullable(Type.String({ description: "Address number", examples: ["659"] }))),
    "complement": Type.Optional(Nullable(Type.String({ description: "Address complement", examples: [null] }))),
    "province": Type.Optional(Nullable(Type.String({ description: "Neighborhood", examples: ["Bom retiro"] }))),
    "city": Type.Optional(Nullable(AccountInfoCity)),
    "denialReason": Type.Optional(Nullable(Type.String({ description: "Reason why it is necessary to resend the information", examples: [null] }))),
    "tradingName": Type.Optional(Nullable(Type.String({ description: "Display name (auto-populated)", examples: [null] }))),
    "site": Type.Optional(Nullable(Type.String({ description: "Web site", examples: [null] }))),
    "availableCompanyNames": Type.Optional(Nullable(Type.Array(Type.String({ description: "Company names available. Only filled in for Legal Entity type accounts.", examples: [["ASAAS GESTAO FINANCEIRA S.A.","ASAAS"]] })))),
    "commercialInfoExpiration": Type.Optional(Nullable(AccountInfoCommercialInfoExpirationResponse)),
  })
export type AccountInfoGetResponse = (typeof AccountInfoGetResponse)['static']

export const AccountInfoSaveRequest = Type.Object({
    "personType": Type.Optional(Nullable(PersonType)),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the account owner", examples: ["66625514000140"] }))),
    "birthDate": Type.Optional(Nullable(Type.String({ description: "Birthday (Required if the information is from an individual)", examples: ["1995-04-12"] }))),
    "companyType": Type.Optional(Nullable(CompanyType)),
    "companyName": Type.Optional(Nullable(Type.String({ description: "Company Name", examples: ["ASAAS"] }))),
    "incomeValue": Type.Optional(Nullable(Type.Number({ description: "Billing/Monthly income", examples: [25000] }))),
    "email": Type.Optional(Nullable(Type.String({ description: "Account's email", examples: ["john.doe@asaas.com.br"] }))),
    "phone": Type.Optional(Nullable(Type.String({ description: "Telephone", examples: [null] }))),
    "mobilePhone": Type.Optional(Nullable(Type.String({ description: "Cell phone", examples: [null] }))),
    "site": Type.Optional(Nullable(Type.String({ description: "Web site", examples: [null] }))),
    "postalCode": Type.Optional(Nullable(Type.String({ description: "Address zip code", examples: ["89223005"] }))),
    "address": Type.Optional(Nullable(Type.String({ description: "Public place", examples: ["Av. Rolf Wiest"] }))),
    "addressNumber": Type.Optional(Nullable(Type.String({ description: "Address number", examples: ["659"] }))),
    "complement": Type.Optional(Nullable(Type.String({ description: "Address complement", examples: [null] }))),
    "province": Type.Optional(Nullable(Type.String({ description: "Neighborhood", examples: ["Bom Retiro"] }))),
  })
export type AccountInfoSaveRequest = (typeof AccountInfoSaveRequest)['static']

export const MyAccountDisableAccountResponse = Type.Object({
    "observations": Type.Optional(Nullable(Type.String({ description: "Deletion information", examples: ["Conta desabilitada com sucesso"] }))),
  })
export type MyAccountDisableAccountResponse = (typeof MyAccountDisableAccountResponse)['static']

/** Anticipation fee on boletos */
export const MyAccountGetAccountFeesAnticipationBankSlip = Type.Object({
    "monthlyFeePercentage": Type.Optional(Nullable(Type.Number({ description: "Monthly fee for invoice charges", examples: [4.99] }))),
  })
export type MyAccountGetAccountFeesAnticipationBankSlip = (typeof MyAccountGetAccountFeesAnticipationBankSlip)['static']

/** Credit card anticipation fee */
export const MyAccountGetAccountFeesAnticipationCreditCard = Type.Object({
    "detachedMonthlyFeeValue": Type.Optional(Nullable(Type.Number({ description: "Monthly fee for upfront charges", examples: [2.49] }))),
    "installmentMonthlyFeeValue": Type.Optional(Nullable(Type.Integer({ description: "Monthly fee for installment payments", examples: [2] }))),
  })
export type MyAccountGetAccountFeesAnticipationCreditCard = (typeof MyAccountGetAccountFeesAnticipationCreditCard)['static']

/** Anticipation fees */
export const MyAccountGetAccountFeesAnticipation = Type.Object({
    "creditCard": Type.Optional(Nullable(MyAccountGetAccountFeesAnticipationCreditCard)),
    "bankSlip": Type.Optional(Nullable(MyAccountGetAccountFeesAnticipationBankSlip)),
  })
export type MyAccountGetAccountFeesAnticipation = (typeof MyAccountGetAccountFeesAnticipation)['static']

/** Serasa consultation fees */
export const MyAccountGetAccountFeesCreditBureauReport = Type.Object({
    "naturalPersonFeeValue": Type.Optional(Nullable(Type.Number({ description: "Fee for Serasa consultation for natural person", examples: [16.99] }))),
    "legalPersonFeeValue": Type.Optional(Nullable(Type.Number({ description: "Fee for Serasa consultation for legal person", examples: [16.99] }))),
  })
export type MyAccountGetAccountFeesCreditBureauReport = (typeof MyAccountGetAccountFeesCreditBureauReport)['static']

/** Invoice fees */
export const MyAccountGetAccountFeesInvoice = Type.Object({
    "feeValue": Type.Optional(Nullable(Type.Number({ description: "Fee per service note issued", examples: [0.99] }))),
  })
export type MyAccountGetAccountFeesInvoice = (typeof MyAccountGetAccountFeesInvoice)['static']

/** Notification fees */
export const MyAccountGetAccountFeesNotification = Type.Object({
    "phoneCallFeeValue": Type.Optional(Nullable(Type.Number({ description: "Fees per voice robot call", examples: [0.55] }))),
    "whatsAppFeeValue": Type.Optional(Nullable(Type.Number({ description: "Fees for notifications via WhatsApp", examples: [0.55] }))),
    "messagingFeeValue": Type.Optional(Nullable(Type.Number({ description: "Fees for sending emails and SMS", examples: [0.99] }))),
  })
export type MyAccountGetAccountFeesNotification = (typeof MyAccountGetAccountFeesNotification)['static']

/** Boleto fees */
export const MyAccountGetAccountFeesPaymentBankSlip = Type.Object({
    "defaultValue": Type.Optional(Nullable(Type.Number({ description: "Fee per charge", examples: [6.96] }))),
    "discountValue": Type.Optional(Nullable(Type.Number({ description: "Promotional fee (If any)", examples: [3.99] }))),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "Promotional fee expiration date (If any)", examples: ["2019-05-19 00:00:00"] }))),
    "daysToReceive": Type.Optional(Nullable(Type.Integer({ description: "Days to receive billing", examples: [1] }))),
  })
export type MyAccountGetAccountFeesPaymentBankSlip = (typeof MyAccountGetAccountFeesPaymentBankSlip)['static']

/** Credit card fees */
export const MyAccountGetAccountFeesPaymentCreditCard = Type.Object({
    "operationValue": Type.Optional(Nullable(Type.Number({ description: "Operating fee per charge", examples: [0.49] }))),
    "oneInstallmentPercentage": Type.Optional(Nullable(Type.Number({ description: "Spot percentage rate", examples: [2.99] }))),
    "upToSixInstallmentsPercentage": Type.Optional(Nullable(Type.Number({ description: "Percentage rate for 2 to 6 installments", examples: [2.99] }))),
    "upToTwelveInstallmentsPercentage": Type.Optional(Nullable(Type.Number({ description: "Percentage rate for 7 to 12 installments", examples: [2.99] }))),
    "upToTwentyOneInstallmentsPercentage": Type.Optional(Nullable(Type.Number({ description: "Percentage rate for 13 to 21 installments", examples: [4.29] }))),
    "discountOneInstallmentPercentage": Type.Optional(Nullable(Type.Number({ description: "Promotional cash percentage rate (If any)", examples: [1.99] }))),
    "discountUpToSixInstallmentsPercentage": Type.Optional(Nullable(Type.Number({ description: "Percentage rate for 2 to 6 promotional installments (If any)", examples: [1.99] }))),
    "discountUpToTwelveInstallmentsPercentage": Type.Optional(Nullable(Type.Number({ description: "Percentage rate for 7 to 12 promotional installments (If any)", examples: [1.99] }))),
    "discountUpToTwentyOneInstallmentsPercentage": Type.Optional(Nullable(Type.Number({ description: "Percentage rate for 13 to 21 promotional installments (if any)", examples: [3.29] }))),
    "discountExpiration": Type.Optional(Nullable(Type.String({ description: "Promotional fee expiration date (If any)", examples: ["2019-05-19 00:00:00"] }))),
    "daysToReceive": Type.Optional(Nullable(Type.Integer({ description: "Days to receive billing", examples: [32] }))),
  })
export type MyAccountGetAccountFeesPaymentCreditCard = (typeof MyAccountGetAccountFeesPaymentCreditCard)['static']

/** Debit card fees */
export const MyAccountGetAccountFeesPaymentDebitCard = Type.Object({
    "operationValue": Type.Optional(Nullable(Type.Number({ description: "Operating fee per charge", examples: [0.35] }))),
    "defaultPercentage": Type.Optional(Nullable(Type.Number({ description: "Percentage rate per charge", examples: [1.89] }))),
    "daysToReceive": Type.Optional(Nullable(Type.Integer({ description: "Days to receive billing", examples: [3] }))),
  })
export type MyAccountGetAccountFeesPaymentDebitCard = (typeof MyAccountGetAccountFeesPaymentDebitCard)['static']

/** Pix Fees */
export const MyAccountGetAccountFeesPaymentPix = Type.Object({
    "fixedFeeValue": Type.Optional(Nullable(Type.Number({ description: "Fixed fee (If any)", examples: [null] }))),
    "fixedFeeValueWithDiscount": Type.Optional(Nullable(Type.Number({ description: "Promotional fixed rate (If any)", examples: [null] }))),
    "percentageFee": Type.Optional(Nullable(Type.Number({ description: "Percentage rate (If any)", examples: [0.99] }))),
    "minimumFeeValue": Type.Optional(Nullable(Type.Number({ description: "Minimum fixed rate in case of percentage rate", examples: [0.29] }))),
    "maximumFeeValue": Type.Optional(Nullable(Type.Number({ description: "Maximum fixed rate in case of percentage rate", examples: [1.99] }))),
    "discountExpiration": Type.Optional(Nullable(Type.String({ description: "Promotional fee expiration date (If any)", examples: [null] }))),
    "monthlyCreditsWithoutFee": Type.Optional(Nullable(Type.Integer({ description: "Number of free transactions per month", examples: [30] }))),
    "creditsReceivedOfCurrentMonth": Type.Optional(Nullable(Type.Integer({ description: "How many transactions have you received this month?", examples: [10] }))),
  })
export type MyAccountGetAccountFeesPaymentPix = (typeof MyAccountGetAccountFeesPaymentPix)['static']

/** Billing fees */
export const MyAccountGetAccountFeesPayment = Type.Object({
    "bankSlip": Type.Optional(Nullable(MyAccountGetAccountFeesPaymentBankSlip)),
    "creditCard": Type.Optional(Nullable(MyAccountGetAccountFeesPaymentCreditCard)),
    "debitCard": Type.Optional(Nullable(MyAccountGetAccountFeesPaymentDebitCard)),
    "pix": Type.Optional(Nullable(MyAccountGetAccountFeesPaymentPix)),
  })
export type MyAccountGetAccountFeesPayment = (typeof MyAccountGetAccountFeesPayment)['static']

/** Serasa negativation fees */
export const MyAccountGetAccountFeesPaymentDunning = Type.Object({
    "feeValue": Type.Optional(Nullable(Type.Number({ description: "Fee per payment", examples: [9.9] }))),
  })
export type MyAccountGetAccountFeesPaymentDunning = (typeof MyAccountGetAccountFeesPaymentDunning)['static']

/** Fees for TED transfers */
export const MyAccountGetAccountFeesTransferTed = Type.Object({
    "feeValue": Type.Optional(Nullable(Type.Number({ description: "Transfer fee via TED", examples: [5] }))),
    "consideredInMonthlyTransfersWithoutFee": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the number of monthly free transactions considers TED", examples: [true] }))),
  })
export type MyAccountGetAccountFeesTransferTed = (typeof MyAccountGetAccountFeesTransferTed)['static']

/** Fees for Pix transfers */
export const MyAccountGetAccountFeesTransferPix = Type.Object({
    "feeValue": Type.Optional(Nullable(Type.Number({ description: "Fee for sending transfers via Pix", examples: [5] }))),
    "discountValue": Type.Optional(Nullable(Type.Number({ description: "Promotional fee (If any)", examples: [null] }))),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "Promotional fee expiration date (If any)", examples: [null] }))),
    "consideredInMonthlyTransfersWithoutFee": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the number of free monthly transactions considers Pix", examples: [true] }))),
  })
export type MyAccountGetAccountFeesTransferPix = (typeof MyAccountGetAccountFeesTransferPix)['static']

/** Transfer fees */
export const MyAccountGetAccountFeesTransfer = Type.Object({
    "monthlyTransfersWithoutFee": Type.Optional(Nullable(Type.Integer({ description: "Number of monthly free transactions", examples: [30] }))),
    "ted": Type.Optional(Nullable(MyAccountGetAccountFeesTransferTed)),
    "pix": Type.Optional(Nullable(MyAccountGetAccountFeesTransferPix)),
  })
export type MyAccountGetAccountFeesTransfer = (typeof MyAccountGetAccountFeesTransfer)['static']

export const MyAccountGetAccountFeesResponse = Type.Object({
    "payment": Type.Optional(Nullable(MyAccountGetAccountFeesPayment)),
    "transfer": Type.Optional(Nullable(MyAccountGetAccountFeesTransfer)),
    "notification": Type.Optional(Nullable(MyAccountGetAccountFeesNotification)),
    "creditBureauReport": Type.Optional(Nullable(MyAccountGetAccountFeesCreditBureauReport)),
    "paymentDunning": Type.Optional(Nullable(MyAccountGetAccountFeesPaymentDunning)),
    "invoice": Type.Optional(Nullable(MyAccountGetAccountFeesInvoice)),
    "anticipation": Type.Optional(Nullable(MyAccountGetAccountFeesAnticipation)),
  })
export type MyAccountGetAccountFeesResponse = (typeof MyAccountGetAccountFeesResponse)['static']

export const MyAccountGetAccountNumberResponse = Type.Object({
    "agency": Type.Optional(Nullable(Type.String({ description: "Account agency", examples: ["0001"] }))),
    "account": Type.Optional(Nullable(Type.String({ description: "Account number", examples: ["6541"] }))),
    "accountDigit": Type.Optional(Nullable(Type.String({ description: "Account digit", examples: ["5"] }))),
  })
export type MyAccountGetAccountNumberResponse = (typeof MyAccountGetAccountNumberResponse)['static']

export const PaymentCheckoutConfigGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["paymentCheckoutConfig"] }))),
    "logoBackgroundColor": Type.Optional(Nullable(Type.String({ description: "Logo background color", examples: ["#00ff00"] }))),
    "infoBackgroundColor": Type.Optional(Nullable(Type.String({ description: "Background color of your information", examples: ["#000fff"] }))),
    "fontColor": Type.Optional(Nullable(Type.String({ description: "Font color of your information", examples: ["#00ff00"] }))),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether personalization is enabled", examples: [true] }))),
    "logoUrl": Type.Optional(Nullable(Type.String({ description: "Logo download link", examples: [null] }))),
    "observations": Type.Optional(Nullable(Type.String({ description: "Invoice personalization analysis notes", examples: ["Aprovado automaticamente pelo sistema."] }))),
    "status": Type.Optional(Nullable(InvoiceConfigStatus)),
  })
export type PaymentCheckoutConfigGetResponse = (typeof PaymentCheckoutConfigGetResponse)['static']

export const PaymentCheckoutConfigSaveRequest = Type.Object({
    "logoBackgroundColor": Type.String({ description: "Logo background color", examples: ["#00ff00"] }),
    "infoBackgroundColor": Type.String({ description: "Background color of your information", examples: ["#000fff"] }),
    "fontColor": Type.String({ description: "Font color of your information", examples: ["#00ff0"] }),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether personalization is enabled", examples: [true] }))),
    "logoFile": Type.Optional(Nullable(File)),
  })
export type PaymentCheckoutConfigSaveRequest = (typeof PaymentCheckoutConfigSaveRequest)['static']

/** List of objects */
export const WalletGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["wallet"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique wallet identifier in Asaas", examples: ["0000c712-0a0b-a0b0-0000-031e7ac51a2"] }))),
  })
export type WalletGetResponse = (typeof WalletGetResponse)['static']

export const WalletShowResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(WalletGetResponse))),
  })
export type WalletShowResponse = (typeof WalletShowResponse)['static']
