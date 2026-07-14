// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { WebhookEvent, WebhookSendType } from '../enums.ts'

export const WebHookConfigRemoveBackoffRequest = Type.Object({})
export type WebHookConfigRemoveBackoffRequest = (typeof WebHookConfigRemoveBackoffRequest)['static']

export const WebhookConfigDeleteResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the Webhook was removed", examples: [false] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique Webhook Identifier", examples: ["bbf67496-1379-4b6d-a348-fd5fa229f1c"] }))),
  })
export type WebhookConfigDeleteResponse = (typeof WebhookConfigDeleteResponse)['static']

export const WebhookConfigGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique Webhook Identifier", examples: ["bbf67496-1379-4b6d-a348-fd5fa229f1c"] }))),
    "name": Type.Optional(Nullable(Type.String({ description: "Webhook name", examples: ["Name Example"] }))),
    "url": Type.Optional(Nullable(Type.String({ description: "Webhook URL", examples: ["https://www.example.com/webhook/asaas"] }))),
    "email": Type.Optional(Nullable(Type.String({ description: "Email that will receive notifications about the Webhook", examples: ["john.doe@asaas.com.br"] }))),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Set whether the Webhook is active", examples: [true] }))),
    "interrupted": Type.Optional(Nullable(Type.Boolean({ description: "Set whether the sync queue is stopped", examples: [false] }))),
    "apiVersion": Type.Optional(Nullable(Type.Integer({ description: "API Version", examples: [3] }))),
    "hasAuthToken": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether an authentication token is registered for the webhook", examples: [true] }))),
    "sendType": Type.Optional(Nullable(WebhookSendType)),
    "penalizedRequestsCount": Type.Optional(Nullable(Type.Integer({ description: "Number of penalized requests", examples: [0] }))),
    "events": Type.Optional(Nullable(Type.Array(WebhookEvent))),
  })
export type WebhookConfigGetResponse = (typeof WebhookConfigGetResponse)['static']

export const WebhookConfigListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(WebhookConfigGetResponse))),
  })
export type WebhookConfigListResponse = (typeof WebhookConfigListResponse)['static']

export const WebhookConfigUpdateRequest = Type.Object({
    "name": Type.Optional(Nullable(Type.String({ description: "Webhook name", examples: ["Name Example"] }))),
    "url": Type.Optional(Nullable(Type.String({ description: "Event destination URL", examples: ["https://www.example.com/webhook/asaas"] }))),
    "sendType": Type.Optional(Nullable(WebhookSendType)),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Set whether the Webhook is active", examples: [true] }))),
    "interrupted": Type.Optional(Nullable(Type.Boolean({ description: "Set whether the sync queue is stopped", examples: [false] }))),
    "authToken": Type.Optional(Nullable(Type.String({ description: "Webhook authentication token", examples: ["whsec_Pxeh17yy3LQbLVpnzz6I1chB7mtzYk5F7pg8bRR80pE"] }))),
    "events": Type.Optional(Nullable(Type.Array(WebhookEvent))),
  })
export type WebhookConfigUpdateRequest = (typeof WebhookConfigUpdateRequest)['static']
