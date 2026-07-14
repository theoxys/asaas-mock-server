/**
 * QR Code do zero — byte mode, correção de erro nível M, versões 1..10. PURO.
 *
 * Existe porque `encodedImage` do Pix é o PNG do QR do BR Code e o projeto não
 * adiciona dependências. Ele precisa ESCANEAR de verdade: um QR de mentira é o
 * caso exemplar do "mock sutilmente errado" — o dev fotografa a tela, o celular
 * não lê, e ele passa a tarde procurando o bug no lugar errado.
 *
 * Limites, explícitos:
 * - nível de correção **fixo em M**;
 * - versões **1..10** → no máximo **213 bytes** em byte mode; acima disso, LANÇA.
 *   O BR Code do Pix cabe: 172 bytes no pior caso do handler (v9), 198 com uma URL
 *   longa do Asaas (v10). Mas uma URL de 60 chars junto de um txid de 25 dá 220 e
 *   estoura — se um dia passarmos txid real, é preciso a tabela de EC da v11+ (e ela
 *   tem que vir da norma, não de dedução: um split de blocos errado gera um QR que
 *   passa nos nossos testes e falha no leitor do banco);
 * - byte mode **sem ECI**: os bytes saem como UTF-8. O BR Code é ASCII puro, então
 *   não há ambiguidade de charset na prática;
 * - o PNG usa blocos deflate *stored* (sem compressão real): é PNG válido e evita
 *   depender de zlib, ao custo de um arquivo maior.
 */

const MODE_BYTE = 0b0100
/** Indicador do nível M no format info (ISO/IEC 18004 §8.9). */
const EC_LEVEL_M = 0b00

export const MIN_VERSION = 1
export const MAX_VERSION = 10

/**
 * ISO/IEC 18004, tabelas 13-22 — **nível M**, versões 1..10:
 * `[ecPorBloco, blocosGrupo1, dadosPorBlocoGrupo1, blocosGrupo2, dadosPorBlocoGrupo2]`.
 * O grupo 2, quando existe, tem exatamente 1 codeword de dado a mais por bloco.
 */
export const EC_BLOCKS_M: Readonly<Record<number, readonly [number, number, number, number, number]>> = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
}

function specOf(version: number): readonly [number, number, number, number, number] {
  const spec = EC_BLOCKS_M[version]
  if (!spec) throw new Error(`qrcode: versão ${version} fora do suporte (${MIN_VERSION}..${MAX_VERSION})`)
  return spec
}

export const moduleCount = (version: number): number => version * 4 + 17

/** Bits do contador de caracteres em byte mode: 8 até a v9, 16 da v10 em diante. */
export const charCountBits = (version: number): number => (version < 10 ? 8 : 16)

export function dataCodewords(version: number): number {
  const [, g1, d1, g2, d2] = specOf(version)
  return g1 * d1 + g2 * d2
}

export function totalCodewords(version: number): number {
  const [ec, g1, , g2] = specOf(version)
  return dataCodewords(version) + (g1 + g2) * ec
}

/** Quantos bytes de payload cabem nesta versão, já descontado o cabeçalho. */
export function capacityBytes(version: number): number {
  return Math.floor((dataCodewords(version) * 8 - 4 - charCountBits(version)) / 8)
}

export function chooseVersion(byteLength: number): number {
  for (let v = MIN_VERSION; v <= MAX_VERSION; v++) {
    if (byteLength <= capacityBytes(v)) return v
  }
  throw new Error(
    `qrcode: ${byteLength} bytes não cabem — o máximo em byte mode/nível M até a v${MAX_VERSION} é ${capacityBytes(MAX_VERSION)}`,
  )
}

// ---------------------------------------------------------------------------
// GF(256) — corpo de Galois do Reed-Solomon do QR (primitivo 0x11d, gerador 2).
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

{
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!
}

/** Polinômio gerador `(x - α⁰)(x - α¹)…(x - αⁿ⁻¹)`, coeficientes do maior grau ao menor. */
function rsGenerator(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] = next[j]! ^ gfMul(poly[j]!, 1)
      next[j + 1] = next[j + 1]! ^ gfMul(poly[j]!, GF_EXP[i]!)
    }
    poly = next
  }
  return poly
}

/** Os `degree` codewords de correção: o resto da divisão de `data·x^degree` pelo gerador. */
export function rsEncode(data: readonly number[], degree: number): number[] {
  const gen = rsGenerator(degree)
  const rem = new Array<number>(degree).fill(0)

  for (const byte of data) {
    const factor = byte ^ rem[0]!
    rem.shift()
    rem.push(0)
    for (let i = 0; i < degree; i++) {
      rem[i] = rem[i]! ^ gfMul(gen[i + 1]!, factor)
    }
  }
  return rem
}

// ---------------------------------------------------------------------------
// Bitstream → codewords
// ---------------------------------------------------------------------------

class BitBuffer {
  readonly bits: number[] = []

  push(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1)
  }
}

/** Codifica o payload em codewords de dados (com terminador e padding). */
export function encodeCodewords(data: string, version: number): number[] {
  const bytes = new TextEncoder().encode(data)
  const capacity = dataCodewords(version)

  const buf = new BitBuffer()
  buf.push(MODE_BYTE, 4)
  buf.push(bytes.length, charCountBits(version))
  for (const byte of bytes) buf.push(byte, 8)

  // Terminador: até 4 zeros, se sobrar espaço.
  const totalBits = capacity * 8
  const terminator = Math.min(4, totalBits - buf.bits.length)
  if (terminator < 0) throw new Error(`qrcode: payload não cabe na versão ${version}`)
  buf.push(0, terminator)
  // Fecha o byte corrente.
  while (buf.bits.length % 8 !== 0) buf.bits.push(0)

  const codewords: number[] = []
  for (let i = 0; i < buf.bits.length; i += 8) {
    let byte = 0
    for (let b = 0; b < 8; b++) byte = (byte << 1) | buf.bits[i + b]!
    codewords.push(byte)
  }
  // Padding alternado 0xEC/0x11 até encher a capacidade (ISO/IEC 18004 §8.4.9).
  for (let pad = 0xec; codewords.length < capacity; pad ^= 0xec ^ 0x11) codewords.push(pad)

  return codewords
}

/** Divide em blocos, gera o ECC de cada um e intercala dados e ECC. */
export function interleave(codewords: readonly number[], version: number): number[] {
  const [ecPerBlock, g1, d1, g2, d2] = specOf(version)

  const dataBlocks: number[][] = []
  const ecBlocks: number[][] = []
  let offset = 0
  for (const [count, size] of [
    [g1, d1],
    [g2, d2],
  ] as const) {
    for (let b = 0; b < count; b++) {
      const block = codewords.slice(offset, offset + size)
      offset += size
      dataBlocks.push(block)
      ecBlocks.push(rsEncode(block, ecPerBlock))
    }
  }

  const out: number[] = []
  const maxData = Math.max(d1, d2)
  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]!)
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) out.push(block[i]!)
  }
  return out
}

// ---------------------------------------------------------------------------
// Matriz
// ---------------------------------------------------------------------------

/** Centros dos alignment patterns (ISO/IEC 18004 §6.3.5). */
export function alignmentCenters(version: number): number[] {
  if (version === 1) return []
  const count = Math.floor(version / 7) + 2
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2
  const result = [6]
  for (let pos = moduleCount(version) - 7; result.length < count; pos -= step) result.splice(1, 0, pos)
  return result
}

type Grid = boolean[][]

const emptyGrid = (size: number): Grid => Array.from({ length: size }, () => new Array<boolean>(size).fill(false))

/** Marca as function patterns e devolve a matriz base + o mapa do que é reservado. */
function drawFunctionPatterns(version: number): { modules: Grid; reserved: Grid } {
  const size = moduleCount(version)
  const modules = emptyGrid(size)
  const reserved = emptyGrid(size)

  const set = (row: number, col: number, dark: boolean): void => {
    modules[row]![col] = dark
    reserved[row]![col] = true
  }

  // Timing: linha 6 e coluna 6 inteiras (os finders sobrescrevem em seguida).
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }

  // Finder + separador: bloco 8×8 em cada uma das três quinas.
  for (const [r0, c0] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ] as const) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr
        const c = c0 + dc
        if (r < 0 || r >= size || c < 0 || c >= size) continue
        const inner = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const ring = dr === 0 || dr === 6 || dc === 0 || dc === 6
        const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
        set(r, c, inner && (ring || core))
      }
    }
  }

  // Alignment: em todo cruzamento de centros, exceto os que colidem com finders.
  const centers = alignmentCenters(version)
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      const last = centers.length - 1
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue
      const cr = centers[i]!
      const cc = centers[j]!
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          set(cr + dr, cc + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1)
        }
      }
    }
  }

  // Reserva do format info (o valor real entra depois de escolhida a máscara).
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      set(8, i, false)
      set(i, 8, false)
    }
  }
  for (let i = 0; i < 8; i++) {
    set(8, size - 1 - i, false)
    set(size - 1 - i, 8, false)
  }
  // Dark module: sempre escuro, sempre em (4v+9, 8).
  set(size - 8, 8, true)

  if (version >= 7) {
    const bits = versionBits(version)
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      set(b, a, dark)
      set(a, b, dark)
    }
  }

  return { modules, reserved }
}

/** BCH(18,6) do version info, gerador 0x1f25 (ISO/IEC 18004 §8.10). */
export function versionBits(version: number): number {
  let rem = version
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
  return ((version << 12) | rem) & 0x3ffff
}

/** BCH(15,5) do format info, gerador 0x537, mascarado com 0x5412 (ISO/IEC 18004 §8.9). */
export function formatBits(mask: number): number {
  const data = (EC_LEVEL_M << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff
}

function drawFormatInfo(modules: Grid, mask: number): void {
  const size = modules.length
  const bits = formatBits(mask)
  const bit = (i: number): boolean => ((bits >>> i) & 1) === 1

  for (let i = 0; i <= 5; i++) modules[i]![8] = bit(i)
  modules[7]![8] = bit(6)
  modules[8]![8] = bit(7)
  modules[8]![7] = bit(8)
  for (let i = 9; i < 15; i++) modules[8]![14 - i] = bit(i)

  for (let i = 0; i < 8; i++) modules[8]![size - 1 - i] = bit(i)
  for (let i = 8; i < 15; i++) modules[size - 15 + i]![8] = bit(i)
}

/** Zigue-zague de baixo-direita para cima, pulando a coluna 6 (timing vertical). */
function placeCodewords(modules: Grid, reserved: Grid, codewords: readonly number[]): void {
  const size = modules.length
  let bitIndex = 0

  const nextBit = (): boolean => {
    const i = bitIndex >>> 3
    // Depois dos codewords vêm os "remainder bits", que são sempre 0.
    if (i >= codewords.length) return false
    const dark = ((codewords[i]! >>> (7 - (bitIndex & 7))) & 1) === 1
    bitIndex++
    return dark
  }

  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step
      for (const col of [right, right - 1]) {
        if (!reserved[row]![col]) modules[row]![col] = nextBit()
      }
    }
    upward = !upward
  }
}

const MASKS: readonly ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

function applyMask(modules: Grid, reserved: Grid, mask: number): void {
  const fn = MASKS[mask]!
  for (let r = 0; r < modules.length; r++) {
    for (let c = 0; c < modules.length; c++) {
      if (!reserved[r]![c] && fn(r, c)) modules[r]![c] = !modules[r]![c]
    }
  }
}

/** Pesos das quatro regras de penalidade: 3, 3, 40 e 10 (ISO/IEC 18004 §8.8.2). */
const [N1, N2, N3, N4] = [3, 3, 40, 10]

export function penalty(modules: Grid): number {
  const size = modules.length
  let score = 0

  // Regra 1: sequências de 5+ módulos da mesma cor, em linhas e colunas.
  for (let i = 0; i < size; i++) {
    for (const line of [
      (j: number) => modules[i]![j]!,
      (j: number) => modules[j]![i]!,
    ]) {
      let run = 1
      for (let j = 1; j < size; j++) {
        if (line(j) === line(j - 1)) {
          run++
          if (run === 5) score += N1
          else if (run > 5) score += 1
        } else run = 1
      }
    }
  }

  // Regra 2: blocos 2×2 de cor uniforme.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r]![c]!
      if (v === modules[r]![c + 1] && v === modules[r + 1]![c] && v === modules[r + 1]![c + 1]) score += N2
    }
  }

  // Regra 3: o padrão 1:1:3:1:1 seguido (ou precedido) de 4 módulos claros.
  const A = [true, false, true, true, true, false, true, false, false, false, false]
  const B = [false, false, false, false, true, false, true, true, true, false, true]
  const matches = (get: (j: number) => boolean, at: number, pat: boolean[]): boolean => {
    for (let k = 0; k < 11; k++) if (get(at + k) !== pat[k]) return false
    return true
  }
  for (let i = 0; i < size; i++) {
    for (const line of [
      (j: number) => modules[i]![j]!,
      (j: number) => modules[j]![i]!,
    ]) {
      for (let j = 0; j + 11 <= size; j++) {
        if (matches(line, j, A)) score += N3
        if (matches(line, j, B)) score += N3
      }
    }
  }

  // Regra 4: desvio da proporção 50/50 entre claro e escuro.
  let dark = 0
  for (const row of modules) for (const v of row) if (v) dark++
  const ratio = (dark * 100) / (size * size)
  score += Math.floor(Math.abs(ratio - 50) / 5) * N4

  return score
}

/**
 * A matriz de módulos final (`true` = escuro), já mascarada e com format/version info.
 * Exposta para que o teste possa decodificá-la de volta sem passar pelo PNG.
 */
export function qrMatrix(data: string): Grid {
  const version = chooseVersion(new TextEncoder().encode(data).length)
  const codewords = interleave(encodeCodewords(data, version), version)

  let best: Grid | undefined
  let bestScore = Infinity

  for (let mask = 0; mask < 8; mask++) {
    const { modules, reserved } = drawFunctionPatterns(version)
    placeCodewords(modules, reserved, codewords)
    applyMask(modules, reserved, mask)
    drawFormatInfo(modules, mask)

    const score = penalty(modules)
    if (score < bestScore) {
      bestScore = score
      best = modules
    }
  }

  return best!
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const CRC32_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC32_TABLE[i] = c >>> 0
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const byte of bytes) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function be32(value: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, value >>> 0, false)
  return out
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const body = new Uint8Array(typeBytes.length + data.length)
  body.set(typeBytes, 0)
  body.set(data, typeBytes.length)

  const out = new Uint8Array(4 + body.length + 4)
  out.set(be32(data.length), 0)
  out.set(body, 4)
  out.set(be32(crc32(body)), 4 + body.length)
  return out
}

/**
 * Stream zlib com blocos deflate *stored* (BTYPE=00): sem compressão, mas é
 * exatamente o que o formato permite — e nos livra de depender de zlib.
 */
/**
 * O IDAT de um PNG é um stream **zlib**, e `Bun.deflateSync` devolve deflate
 * **cru** — sem o header de 2 bytes e sem o Adler-32 no fim. Envelopar é o que
 * falta, e omitir isso gera um PNG que alguns leitores aceitam e outros recusam.
 *
 * (Usar o deflate do runtime cabe no domínio puro: é determinístico e não é I/O.
 * É a diferença entre um `encodedImage` de ~3 KB e um de 175 KB, que era o que
 * dava emitir blocos *stored*. A imagem de um QR é quase toda branco.)
 */
function zlibDeflate(raw: Uint8Array<ArrayBuffer>): Uint8Array {
  const deflated = Bun.deflateSync(raw)

  const out = new Uint8Array(2 + deflated.length + 4)
  out[0] = 0x78 // CM = deflate, CINFO = janela de 32K
  out[1] = 0x01 // FLEVEL + FCHECK: (0x78<<8 | 0x01) % 31 === 0
  out.set(deflated, 2)
  out.set(be32(adler32(raw)), 2 + deflated.length)
  return out
}

export interface QrPngOptions {
  /** Pixels por módulo. */
  scale?: number
  /** Quiet zone em módulos — o padrão do QR é 4. */
  quietZone?: number
}

/** O QR como PNG em base64, sem o prefixo `data:` — pronto para `encodedImage`. */
export function qrPng(data: string, options: QrPngOptions = {}): string {
  const scale = options.scale ?? 6
  const quiet = options.quietZone ?? 4

  const modules = qrMatrix(data)
  const size = modules.length
  const side = (size + quiet * 2) * scale

  // Grayscale 8 bits: cada scanline começa com o byte de filtro 0 (None).
  const raw = new Uint8Array(side * (side + 1))
  raw.fill(0xff)
  for (let y = 0; y < side; y++) {
    const rowStart = y * (side + 1)
    raw[rowStart] = 0
    const moduleRow = Math.floor(y / scale) - quiet
    if (moduleRow < 0 || moduleRow >= size) continue
    for (let x = 0; x < side; x++) {
      const moduleCol = Math.floor(x / scale) - quiet
      if (moduleCol < 0 || moduleCol >= size) continue
      if (modules[moduleRow]![moduleCol]) raw[rowStart + 1 + x] = 0x00
    }
  }

  const ihdr = new Uint8Array(13)
  ihdr.set(be32(side), 0)
  ihdr.set(be32(side), 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 0 // color type: grayscale
  ihdr[10] = 0 // compression: deflate
  ihdr[11] = 0 // filter: adaptive
  ihdr[12] = 0 // interlace: none

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(chunk('IHDR', ihdr)),
    Buffer.from(chunk('IDAT', zlibDeflate(raw))),
    Buffer.from(chunk('IEND', new Uint8Array(0))),
  ])

  return png.toString('base64')
}
