// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { CompanyType, CustomerApiAccessTokenDisabledReason, PersonType } from '../enums.ts'
import { AccountInfoCommercialInfoExpirationResponse, WebhookConfigSaveRequest } from './common.ts'

export const AccountDeleteResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the subaccount has been closed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique subaccount identifier in Asaas", examples: ["4f468235-cec3-482f-b3d0-348af4c71940"] }))),
  })
export type AccountDeleteResponse = (typeof AccountDeleteResponse)['static']

/** Subaccount number in Asaas */
export const AccountNumber = Type.Object({
    "agency": Type.Optional(Nullable(Type.String({ description: "Account agency", examples: ["0001"] }))),
    "account": Type.Optional(Nullable(Type.String({ description: "Account number", examples: ["3514"] }))),
    "accountDigit": Type.Optional(Nullable(Type.String({ description: "Account digit", examples: ["3"] }))),
  })
export type AccountNumber = (typeof AccountNumber)['static']

export const AccountGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["account"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique subaccount identifier in Asaas", examples: ["4f468235-cec3-482f-b3d0-348af4c7194"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Subaccount name", examples: ["John Doe"] }))),
    "email": Type.Optional(Nullable(Type.String({ description: "Subaccount email", examples: ["john.doe@asaas.com.br"] }))),
    "loginEmail": Type.Optional(Nullable(Type.String({ description: "Email for subaccount login, if not provided, the subaccount email will be used", examples: ["john.doe@asaas.com.br"] }))),
    "phone": Type.Optional(Nullable(Type.String({ description: "Telephone", examples: [null] }))),
    "mobilePhone": Type.Optional(Nullable(Type.String({ description: "Cellphone", examples: [null] }))),
    "address": Type.Optional(Nullable(Type.String({ description: "Public place", examples: ["Rua Fernando Orlandi"] }))),
    "addressNumber": Type.Optional(Nullable(Type.String({ description: "Address number", examples: ["544"] }))),
    "complement": Type.Optional(Nullable(Type.String({ description: "Address complement", examples: [null] }))),
    "province": Type.Optional(Nullable(Type.String({ description: "Neighborhood", examples: ["Jardim Pedra Branca"] }))),
    "postalCode": Type.Optional(Nullable(Type.String({ description: "Address zip code", examples: ["14079-452"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the subaccount owner", examples: ["35381637000150"] }))),
    "birthDate": Type.Optional(Nullable(Type.String({ description: "Date of birth (only for Individuals)", examples: ["1995-04-12"] }))),
    "personType": Type.Optional(Nullable(PersonType)),
    "companyType": Type.Optional(Nullable(CompanyType)),
    "city": Type.Optional(Nullable(Type.Integer({ description: "Unique city identifier in Asaas", examples: [15478] }))),
    "state": Type.Optional(Nullable(Type.String({ description: "State abbreviation (SP, RJ, SC, ...)", examples: ["SP"] }))),
    "country": Type.Optional(Nullable(Type.String({ description: "Country (Fixed Brazil)", examples: ["Brasil"] }))),
    "tradingName": Type.Optional(Nullable(Type.String({ description: "Display name (auto-populated)", examples: [null] }))),
    "site": Type.Optional(Nullable(Type.String({ description: "Url reffered to the subaccount", examples: ["https://www.example.com"] }))),
    "walletId": Type.Optional(Nullable(Type.String({ description: "Unique wallet identifier to split charges or transfer between Asaas accounts", examples: ["c0c1688f-636b-42c0-b6ee-7339182276b7"] }))),
    "accountNumber": Type.Optional(Nullable(AccountNumber)),
    "commercialInfoExpiration": Type.Optional(Nullable(AccountInfoCommercialInfoExpirationResponse)),
  })
export type AccountGetResponse = (typeof AccountGetResponse)['static']

export const AccountListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(AccountGetResponse))),
  })
export type AccountListResponse = (typeof AccountListResponse)['static']

export const AccountResendActivationLinkRequest = Type.Object({})
export type AccountResendActivationLinkRequest = (typeof AccountResendActivationLinkRequest)['static']

export const AccountSaveRequest = Type.Object({
    "name": Type.String({ description: "Subaccount name", examples: ["John Doe"] }),
    "email": Type.String({ description: "Subaccount email", examples: ["john.doe@asaas.com.br"] }),
    "loginEmail": Type.Optional(Nullable(Type.String({ description: "Email for subaccount login, if not provided, the subaccount email will be used", examples: ["johndoe@asaas.com.br"] }))),
    "cpfCnpj": Type.String({ description: "CPF or CNPJ of the subaccount owner", examples: ["35381637000150"] }),
    "birthDate": Type.Optional(Nullable(Type.String({ description: "Date of birth (only for Individuals)", examples: ["1995-04-12"] }))),
    "companyType": Type.Optional(Nullable(CompanyType)),
    "phone": Type.Optional(Nullable(Type.String({ description: "Telephone", examples: [null] }))),
    "mobilePhone": Type.String({ description: "Cellphone", examples: [null] }),
    "site": Type.Optional(Nullable(Type.String({ description: "Url reffered to the subaccount", examples: ["https://www.example.com"] }))),
    "incomeValue": Type.Number({ description: "Billing/Monthly income", examples: [25000] }),
    "address": Type.String({ description: "Public place", examples: ["Rua Fernando Orlandi"] }),
    "addressNumber": Type.String({ description: "Address number", examples: ["544"] }),
    "complement": Type.Optional(Nullable(Type.String({ description: "Address complement", examples: [null] }))),
    "province": Type.String({ description: "Neighborhood", examples: ["Jardim Pedra Branca"] }),
    "postalCode": Type.String({ description: "Address zip code", examples: ["14079-452"] }),
    "webhooks": Type.Optional(Nullable(Type.Array(WebhookConfigSaveRequest))),
  })
export type AccountSaveRequest = (typeof AccountSaveRequest)['static']

export const CustomerApiAccessTokenSaveResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "API key ID", examples: ["b6bff0c5-38c6-496a-a3a8-105b31d5bcfe"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "API key name", examples: ["My API Access Token"] }))),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the API key is enabled", examples: [false] }))),
    "disabledReason": Type.Optional(Nullable(CustomerApiAccessTokenDisabledReason)),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "API key expiration date", examples: ["2026-12-31 12:30:50"] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "API key creation date", examples: ["2026-01-01 08:00:00"] }))),
    "projectedExpirationDateByLackOfUse": Type.Optional(Nullable(Type.String({ description: "Projected expiration date due to lack of use of the API key", examples: ["2026-06-01"] }))),
    "apiKey": Type.Optional(Nullable(Type.String({ description: "API key", examples: ["$aact_hmlg_xxxxx"] }))),
  })
export type CustomerApiAccessTokenSaveResponse = (typeof CustomerApiAccessTokenSaveResponse)['static']

export const AccountSaveResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["account"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique subaccount identifier in Asaas", examples: ["4f468235-cec3-482f-b3d0-348af4c7194"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Subaccount name", examples: ["John Doe"] }))),
    "email": Type.Optional(Nullable(Type.String({ description: "Subaccount email", examples: ["john.doe@asaas.com.br"] }))),
    "loginEmail": Type.Optional(Nullable(Type.String({ description: "Email for subaccount login, if not provided, the subaccount email will be used", examples: ["john.doe@asaas.com.br"] }))),
    "phone": Type.Optional(Nullable(Type.String({ description: "Telephone", examples: [null] }))),
    "mobilePhone": Type.Optional(Nullable(Type.String({ description: "Cellphone", examples: [null] }))),
    "address": Type.Optional(Nullable(Type.String({ description: "Public place", examples: ["Rua Fernando Orlandi"] }))),
    "addressNumber": Type.Optional(Nullable(Type.String({ description: "Address number", examples: ["544"] }))),
    "complement": Type.Optional(Nullable(Type.String({ description: "Address complement", examples: [null] }))),
    "province": Type.Optional(Nullable(Type.String({ description: "Neighborhood", examples: ["Jardim Pedra Branca"] }))),
    "postalCode": Type.Optional(Nullable(Type.String({ description: "Address zip code", examples: ["14079-452"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "CPF or CNPJ of the subaccount owner", examples: ["35381637000150"] }))),
    "birthDate": Type.Optional(Nullable(Type.String({ description: "Date of birth (only for Individuals)", examples: ["1995-04-12"] }))),
    "personType": Type.Optional(Nullable(PersonType)),
    "companyType": Type.Optional(Nullable(CompanyType)),
    "city": Type.Optional(Nullable(Type.Integer({ description: "Unique city identifier in Asaas", examples: [15478] }))),
    "state": Type.Optional(Nullable(Type.String({ description: "State abbreviation (SP, RJ, SC, ...)", examples: ["SP"] }))),
    "country": Type.Optional(Nullable(Type.String({ description: "Country (Fixed Brazil)", examples: ["Brasil"] }))),
    "tradingName": Type.Optional(Nullable(Type.String({ description: "Display name (auto-populated)", examples: [null] }))),
    "site": Type.Optional(Nullable(Type.String({ description: "Url reffered to the subaccount", examples: ["https://www.example.com"] }))),
    "walletId": Type.Optional(Nullable(Type.String({ description: "Unique wallet identifier to split charges or transfer between Asaas accounts", examples: ["c0c1688f-636b-42c0-b6ee-7339182276b7"] }))),
    "accountNumber": Type.Optional(Nullable(AccountNumber)),
    "commercialInfoExpiration": Type.Optional(Nullable(AccountInfoCommercialInfoExpirationResponse)),
    "accessToken": Type.Optional(Nullable(CustomerApiAccessTokenSaveResponse)),
  })
export type AccountSaveResponse = (typeof AccountSaveResponse)['static']

export const CustomerApiAccessTokenBaseResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "API key ID", examples: ["b6bff0c5-38c6-496a-a3a8-105b31d5bcfe"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "API key name", examples: ["My API Access Token"] }))),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the API key is enabled", examples: [false] }))),
    "disabledReason": Type.Optional(Nullable(CustomerApiAccessTokenDisabledReason)),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "API key expiration date", examples: ["2026-12-31 12:30:50"] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "API key creation date", examples: ["2026-01-01 08:00:00"] }))),
    "projectedExpirationDateByLackOfUse": Type.Optional(Nullable(Type.String({ description: "Projected expiration date due to lack of use of the API key", examples: ["2026-06-01"] }))),
  })
export type CustomerApiAccessTokenBaseResponse = (typeof CustomerApiAccessTokenBaseResponse)['static']

export const CustomerApiAccessTokenListResponse = Type.Object({
    "accessTokens": Type.Optional(Nullable(Type.Array(CustomerApiAccessTokenBaseResponse))),
  })
export type CustomerApiAccessTokenListResponse = (typeof CustomerApiAccessTokenListResponse)['static']

export const CustomerApiAccessTokenSaveRequest = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "API key name", examples: ["My API Access Token"] }))),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "API key expiration date", examples: ["2026-12-31 12:30:50"] }))),
  })
export type CustomerApiAccessTokenSaveRequest = (typeof CustomerApiAccessTokenSaveRequest)['static']

export const CustomerApiAccessTokenUpdateRequest = Type.Object({
    "name": Type.String({ description: "API key name", examples: ["My API Access Token"] }),
    "enabled": Type.Boolean({ description: "Indicates whether the API key is enabled", examples: [true] }),
    "expirationDate": Type.String({ description: "API key expiration date", examples: ["2026-12-31 12:30:50"] }),
  })
export type CustomerApiAccessTokenUpdateRequest = (typeof CustomerApiAccessTokenUpdateRequest)['static']
