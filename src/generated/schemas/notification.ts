// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { NotificationGetResponse } from './common.ts'

/** List of notification information */
export const NotificationBatchUpdateItemRequest = Type.Object({
    "id": Type.String({ description: "Unique identifier of the notification to be updated", examples: ["not_wuGp97JeCr7G"] }),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Enable/disable notification", examples: [true] }))),
    "emailEnabledForProvider": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable the email sent to you", examples: [true] }))),
    "smsEnabledForProvider": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable the SMS sent to you", examples: [true] }))),
    "emailEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable the email sent to your customer", examples: [true] }))),
    "smsEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable the SMS sent to your customer", examples: [true] }))),
    "phoneCallEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable voice notification sent to your customer", examples: [false] }))),
    "whatsappEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable WhatsApp messages for your customer", examples: [false] }))),
    "scheduleOffset": Type.Optional(Nullable(Type.Integer({ description: "Specifies how many days before the due date the notification must be sent.\n For the `PAYMENT_DUEDATE_WARNING` event, the accepted values are: `0`, `5`, `10`, `15` and `30`\n For the `PAYMENT_OVERDUE` event, the accepted values are: `1`, `7`, `15` and `30`", examples: [1] }))),
  })
export type NotificationBatchUpdateItemRequest = (typeof NotificationBatchUpdateItemRequest)['static']

export const NotificationBatchUpdateRequest = Type.Object({
    "customer": Type.String({ description: "Unique customer identifier in Asaas", examples: ["cus_000005401844"] }),
    "notifications": Type.Optional(Nullable(Type.Array(NotificationBatchUpdateItemRequest))),
  })
export type NotificationBatchUpdateRequest = (typeof NotificationBatchUpdateRequest)['static']

export const NotificationBatchUpdateResponse = Type.Object({
    "notifications": Type.Optional(Nullable(Type.Array(NotificationGetResponse))),
  })
export type NotificationBatchUpdateResponse = (typeof NotificationBatchUpdateResponse)['static']

export const NotificationUpdateRequest = Type.Object({
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Enable/disable notification", examples: [true] }))),
    "emailEnabledForProvider": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable the email sent to you", examples: [true] }))),
    "smsEnabledForProvider": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable the SMS sent to you", examples: [true] }))),
    "emailEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable the email sent to your customer", examples: [true] }))),
    "smsEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable the SMS sent to your customer", examples: [true] }))),
    "phoneCallEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable voice notification sent to your customer", examples: [false] }))),
    "whatsappEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "enable/disable WhatsApp messages for your customer", examples: [false] }))),
    "scheduleOffset": Type.Optional(Nullable(Type.Integer({ description: "Specifies how many days before the due date the notification must be sent.\n For the `PAYMENT_DUEDATE_WARNING` event, the accepted values are: `0`, `5`, `10`, `15` and `30`\n For the `PAYMENT_OVERDUE` event, the accepted values are: `1`, `7`, `15` and `30`", examples: [1] }))),
  })
export type NotificationUpdateRequest = (typeof NotificationUpdateRequest)['static']
