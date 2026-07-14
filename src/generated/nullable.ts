// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type, type TSchema } from '@sinclair/typebox'

/**
 * A spec do Asaas não declara `nullable` em lugar nenhum, mas a API devolve
 * `null` em dezenas de campos (originalValue, paymentDate, creditCard, split…).
 * Todo campo opcional é envelopado aqui para que a validação de contrato não
 * rejeite uma resposta legítima. Campos `required` continuam estritos.
 */
export const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()])
