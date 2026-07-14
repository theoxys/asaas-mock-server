/**
 * Envelope de listagem do Asaas:
 *
 *   { "object": "list", "hasMore": false, "totalCount": 12,
 *     "limit": 10, "offset": 0, "data": [ … ] }
 */
import { invalid } from './errors.ts'

export const DEFAULT_LIMIT = 10
export const MAX_LIMIT = 100

export interface ListEnvelope<T> {
  object: 'list'
  hasMore: boolean
  totalCount: number
  limit: number
  offset: number
  data: T[]
}

export function paginationParams(query: { limit?: unknown; offset?: unknown }): {
  limit: number
  offset: number
} {
  const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit)
  const offset = query.offset === undefined ? 0 : Number(query.offset)

  if (!Number.isInteger(limit) || limit < 0 || limit > MAX_LIMIT) {
    throw invalid('limit', `O limite deve ser um número inteiro entre 0 e ${MAX_LIMIT}.`)
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw invalid('offset', 'O offset deve ser um número inteiro maior ou igual a zero.')
  }
  return { limit, offset }
}

export function listEnvelope<T>(
  data: T[],
  totalCount: number,
  limit: number,
  offset: number,
): ListEnvelope<T> {
  return {
    object: 'list',
    hasMore: offset + data.length < totalCount,
    totalCount,
    limit,
    offset,
    data,
  }
}
