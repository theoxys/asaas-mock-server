/**
 * Fonte de aleatoriedade. Injetada, nunca global.
 *
 * `Math.random()` e `crypto.randomUUID()` são PROIBIDOS no resto do código pelo
 * mesmo motivo que `Date.now()`: sem RNG semeado, os IDs mudam a cada execução e
 * qualquer teste de snapshot ou de determinismo vira ruído.
 */
export interface Rng {
  /** [0, 1) */
  float(): number
  /** inteiro em [0, max) */
  int(max: number): number
  /** string hex de `len` caracteres */
  hex(len: number): string
  /** UUID v4 */
  uuid(): string
  /** `len` dígitos decimais, como string (pode começar com 0) */
  digits(len: number): string
  /** caracteres de um alfabeto alfanumérico */
  alphanumeric(len: number): string
}

const HEX = '0123456789abcdef'
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

abstract class BaseRng implements Rng {
  abstract float(): number

  int(max: number): number {
    return Math.floor(this.float() * max)
  }

  hex(len: number): string {
    let out = ''
    for (let i = 0; i < len; i++) out += HEX[this.int(16)]
    return out
  }

  digits(len: number): string {
    let out = ''
    for (let i = 0; i < len; i++) out += String(this.int(10))
    return out
  }

  alphanumeric(len: number): string {
    let out = ''
    for (let i = 0; i < len; i++) out += ALNUM[this.int(ALNUM.length)]
    return out
  }

  uuid(): string {
    const h = this.hex(32).split('')
    // versão 4 e variante RFC 4122
    h[12] = '4'
    h[16] = HEX[(this.int(16) & 0x3) | 0x8]!
    const s = h.join('')
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
  }
}

/** xorshift128. Mesma semente → mesma sequência de IDs. */
export class SeededRng extends BaseRng {
  #a: number
  #b: number
  #c: number
  #d: number

  constructor(seed: number) {
    super()
    // espalha a semente para que seeds pequenas (1, 2, 3) não degenerem
    this.#a = seed | 0 || 0x9e3779b9
    this.#b = (seed * 0x85ebca6b) | 0 || 0x243f6a88
    this.#c = (seed * 0xc2b2ae35) | 0 || 0xb7e15162
    this.#d = (seed * 0x27d4eb2f) | 0 || 0x9e3779b9
    for (let i = 0; i < 12; i++) this.float() // aquece
  }

  override float(): number {
    let t = this.#d
    const s = this.#a
    this.#d = this.#c
    this.#c = this.#b
    this.#b = s
    t ^= t << 11
    t ^= t >>> 8
    this.#a = (t ^ s ^ (s >>> 19)) | 0
    return (this.#a >>> 0) / 0x1_0000_0000
  }
}

export class CryptoRng extends BaseRng {
  override float(): number {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0]! / 0x1_0000_0000
  }
}

export function createRng(seed: number | undefined): Rng {
  return seed === undefined ? new CryptoRng() : new SeededRng(seed)
}
