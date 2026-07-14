// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { CreditCardHolderInfoRequest, CreditCardRequest } from './common.ts'

export const CreditCardPreAuthorizationConfigRequest = Type.Object({
    "daysToExpire": Type.Integer({ description: "Number of days until the pre-authorization expires", examples: [5] }),
  })
export type CreditCardPreAuthorizationConfigRequest = (typeof CreditCardPreAuthorizationConfigRequest)['static']

export const CreditCardPreAuthorizationConfigResponse = Type.Object({
    "daysToExpire": Type.Integer({ description: "Number of days until the pre-authorization expires", examples: [5] }),
  })
export type CreditCardPreAuthorizationConfigResponse = (typeof CreditCardPreAuthorizationConfigResponse)['static']

export const CreditCardTokenizeRequest = Type.Object({
    "customer": Type.String({ description: "Unique customer identifier in Asaas", examples: ["cus_G7Dvo4iphUNk"] }),
    "creditCard": CreditCardRequest,
    "creditCardHolderInfo": CreditCardHolderInfoRequest,
    "remoteIp": Type.String({ description: "IP from where the customer is making the purchase. Your server's IP must not be entered.", examples: ["116.213.42.532"] }),
  })
export type CreditCardTokenizeRequest = (typeof CreditCardTokenizeRequest)['static']
