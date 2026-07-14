/**
 * AppContext — tudo que é impuro, num objeto só, injetado.
 *
 * Se uma função precisa de tempo, aleatoriedade, banco ou configuração, ela
 * recebe o contexto. Nada disso é global. É o que torna o servidor inteiro
 * instanciável em memória num teste, com relógio congelado e RNG semeado.
 *
 * `src/domain/` NÃO importa isto: as funções de domínio são puras e recebem
 * `now: Date` e os valores de que precisam como argumentos.
 */
import type { DB } from '../db/client.ts'
import type { Clock } from './clock.ts'
import type { Config } from './config.ts'
import type { DomainEvent } from './events.ts'
import type { Rng } from './rng.ts'

export interface AppContext {
  config: Config
  db: DB
  clock: Clock
  rng: Rng
  /**
   * Enfileira um evento de webhook. Chame DENTRO da transação que causou o
   * evento — o payload é congelado agora, não na hora da entrega.
   */
  emit(tx: DB, event: DomainEvent): Promise<void>
  log(level: 'debug' | 'info' | 'warn' | 'error', msg: string, data?: unknown): void

  /**
   * Preenchido pelo registro de rotas. É computado do manifesto — a cobertura em
   * GET /_admin/coverage nunca é um número mantido à mão.
   */
  coverage?: { implemented: string[]; stubbed: string[]; variants: string[] }
}

/** A conta autenticada pelo header `access_token`. */
export interface AuthContext {
  accountId: string
  walletId: string
  apiKeyId: string
}
