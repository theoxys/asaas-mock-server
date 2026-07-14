// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { PersonType } from '../enums.ts'
import { NotificationGetResponse } from './common.ts'

export const CustomerDeleteResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the client has been removed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier", examples: ["cus_000005401844"] }))),
  })
export type CustomerDeleteResponse = (typeof CustomerDeleteResponse)['static']

export const CustomerGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["customer"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier", examples: ["cus_000005401844"] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Customer creation date", examples: ["2024-07-12"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Client name", examples: ["John Doe"] }))),
    "email": Type.Optional(Nullable(Type.String({ description: "Customer email", examples: ["john.doe@asaas.com.br"] }))),
    "phone": Type.Optional(Nullable(Type.String({ description: "Customer phone", examples: ["90999999999"] }))),
    "mobilePhone": Type.Optional(Nullable(Type.String({ description: "Customer cell phone", examples: ["90999999999"] }))),
    "address": Type.Optional(Nullable(Type.String({ description: "Customer address", examples: ["Av. Paulista"] }))),
    "addressNumber": Type.Optional(Nullable(Type.String({ description: "Customer address number", examples: ["150"] }))),
    "complement": Type.Optional(Nullable(Type.String({ description: "Customer address complement", examples: ["Sala 201"] }))),
    "province": Type.Optional(Nullable(Type.String({ description: "Customer address neighborhood", examples: ["Centro"] }))),
    "city": Type.Optional(Nullable(Type.Integer({ description: "Unique city identifier in Asaas", examples: [12565] }))),
    "cityName": Type.Optional(Nullable(Type.String({ description: "City of customer address", examples: ["São Paulo"] }))),
    "state": Type.Optional(Nullable(Type.String({ description: "Customer address status", examples: ["SP"] }))),
    "country": Type.Optional(Nullable(Type.String({ description: "Customer country", examples: ["Brasil"] }))),
    "postalCode": Type.Optional(Nullable(Type.String({ description: "Customer address zip code", examples: ["01310000"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "Customer CPF or CNPJ", examples: ["24971563792"] }))),
    "personType": Type.Optional(Nullable(PersonType)),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether it is a deleted client", examples: [false] }))),
    "additionalEmails": Type.Optional(Nullable(Type.String({ description: "Additional customer emails", examples: ["john.doe@asaas.com,john.doe.silva@asaas.com.br"] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "External customer reference", examples: ["12987382"] }))),
    "notificationDisabled": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether notifications are disabled", examples: [false] }))),
    "observations": Type.Optional(Nullable(Type.String({ description: "Customer Observations", examples: ["great payer, no problems so far"] }))),
    "foreignCustomer": Type.Optional(Nullable(Type.Boolean({ description: "Indicates if it's non-brazilian customer", examples: [false] }))),
  })
export type CustomerGetResponse = (typeof CustomerGetResponse)['static']

export const CustomerListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(CustomerGetResponse))),
  })
export type CustomerListResponse = (typeof CustomerListResponse)['static']

export const CustomerRestoreRequest = Type.Object({})
export type CustomerRestoreRequest = (typeof CustomerRestoreRequest)['static']

export const CustomerSaveRequest = Type.Object({
    "name": Type.String({ description: "Client name", examples: ["John Doe"] }),
    "cpfCnpj": Type.String({ description: "Customer CPF or CNPJ", examples: ["24971563792"] }),
    "email": Type.Optional(Nullable(Type.String({ description: "Customer email", examples: ["john.doe@asaas.com.br"] }))),
    "phone": Type.Optional(Nullable(Type.String({ description: "Landline", examples: ["4738010919"] }))),
    "mobilePhone": Type.Optional(Nullable(Type.String({ description: "Cell phone", examples: ["4799376637"] }))),
    "address": Type.Optional(Nullable(Type.String({ description: "Public place", examples: ["Av. Paulista"] }))),
    "addressNumber": Type.Optional(Nullable(Type.String({ description: "Address number", examples: ["150"] }))),
    "complement": Type.Optional(Nullable(Type.String({ description: "Address complement (max. 255 characters)", examples: ["Sala 201"] }))),
    "province": Type.Optional(Nullable(Type.String({ description: "Neighborhood", examples: ["Centro"] }))),
    "postalCode": Type.Optional(Nullable(Type.String({ description: "Address zip code", examples: ["01310-000"] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Customer identifier in your system", examples: ["12987382"] }))),
    "notificationDisabled": Type.Optional(Nullable(Type.Boolean({ description: "true to disable sending billing notifications", examples: [false] }))),
    "additionalEmails": Type.Optional(Nullable(Type.String({ description: "Additional emails for sending billing notifications separated by \",\"", examples: ["john.doe@asaas.com,john.doe.silva@asaas.com.br"] }))),
    "municipalInscription": Type.Optional(Nullable(Type.String({ description: "Customer municipal registration", examples: ["46683695908"] }))),
    "stateInscription": Type.Optional(Nullable(Type.String({ description: "Customer state registration", examples: ["646681195275"] }))),
    "observations": Type.Optional(Nullable(Type.String({ description: "Additional observations", examples: ["great payer, no problems so far"] }))),
    "groupName": Type.Optional(Nullable(Type.String({ description: "Name of the group the customer belongs to", examples: [null] }))),
    "company": Type.Optional(Nullable(Type.String({ description: "Company", examples: [null] }))),
    "foreignCustomer": Type.Optional(Nullable(Type.Boolean({ description: "inform true if it's a non-brazilian customer", examples: [false] }))),
  })
export type CustomerSaveRequest = (typeof CustomerSaveRequest)['static']

export const CustomerUpdateRequest = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Client name", examples: ["John Doe"] }))),
    "cpfCnpj": Type.Optional(Nullable(Type.String({ description: "Customer CPF or CNPJ", examples: ["24971563792"] }))),
    "email": Type.Optional(Nullable(Type.String({ description: "Customer email", examples: ["john.doe@asaas.com.br"] }))),
    "phone": Type.Optional(Nullable(Type.String({ description: "Landline", examples: ["4738010919"] }))),
    "mobilePhone": Type.Optional(Nullable(Type.String({ description: "Cell phone", examples: ["4799376637"] }))),
    "address": Type.Optional(Nullable(Type.String({ description: "Public place", examples: ["Av. Paulista"] }))),
    "addressNumber": Type.Optional(Nullable(Type.String({ description: "Address number", examples: ["150"] }))),
    "complement": Type.Optional(Nullable(Type.String({ description: "Address complement", examples: ["Sala 201"] }))),
    "province": Type.Optional(Nullable(Type.String({ description: "Neighborhood", examples: ["Centro"] }))),
    "postalCode": Type.Optional(Nullable(Type.String({ description: "Address zip code", examples: ["01310-000"] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Customer identifier in your system", examples: ["12987382"] }))),
    "notificationDisabled": Type.Optional(Nullable(Type.Boolean({ description: "true to disable sending billing notifications", examples: [false] }))),
    "additionalEmails": Type.Optional(Nullable(Type.String({ description: "Additional emails for sending billing notifications separated by \",\"", examples: ["john.doe@asaas.com,john.doe.silva@asaas.com.br"] }))),
    "municipalInscription": Type.Optional(Nullable(Type.String({ description: "Customer municipal registration", examples: ["46683695908"] }))),
    "stateInscription": Type.Optional(Nullable(Type.String({ description: "Customer state registration", examples: ["646681195275"] }))),
    "observations": Type.Optional(Nullable(Type.String({ description: "Additional observations", examples: ["great payer, no problems so far"] }))),
    "groupName": Type.Optional(Nullable(Type.String({ description: "Name of the group the customer belongs to", examples: [null] }))),
    "company": Type.Optional(Nullable(Type.String({ description: "Company", examples: [null] }))),
    "foreignCustomer": Type.Optional(Nullable(Type.Boolean({ description: "inform true if it's a non-brazilian customer", examples: [false] }))),
  })
export type CustomerUpdateRequest = (typeof CustomerUpdateRequest)['static']

export const NotificationListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(NotificationGetResponse))),
  })
export type NotificationListResponse = (typeof NotificationListResponse)['static']
