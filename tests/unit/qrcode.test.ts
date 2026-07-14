/**
 * Um teste que só verifica "gerou algum PNG" não prova nada — o QR precisa
 * ESCANEAR. Então este arquivo escreve um **decodificador** e faz o caminho de
 * volta inteiro:
 *
 *   string → qrPng → base64 → bytes PNG → inflate → pixels → matriz de módulos
 *          → format info (BCH) → desmascara → zigue-zague → codewords
 *          → de-interleave → Reed-Solomon (síndromes) → bits → string
 *
 * O decodificador é escrito do lado da LEITURA, a partir da ISO/IEC 18004 — ele não
 * chama as funções privadas do encoder. Onde encoder e decoder poderiam
 * compartilhar uma mesma constante errada (as tabelas de EC, os centros de
 * alignment, o BCH do format info), o teste confere contra os valores PUBLICADOS
 * da norma e contra a geometria da própria matriz.
 */
import { describe, expect, it } from 'bun:test'
import {
  EC_BLOCKS_M,
  alignmentCenters,
  capacityBytes,
  chooseVersion,
  formatBits,
  moduleCount,
  qrMatrix,
  qrPng,
  totalCodewords,
  versionBits,
} from '../../src/domain/qrcode.ts'

/** O BR Code real do sandbox — o payload que este QR existe para carregar. */
const PIX_PAYLOAD =
  '00020101021226820014br.gov.bcb.pix2560pix-h.asaas.com/qr/cobv/618c88aa-7beb-4abf-ad17-4213dc8fa3805204000053039865802BR5919Pr Solucoes Sandbox6007Itajuba61083750228062070503***6304C50D'

// ---------------------------------------------------------------------------
// PNG → pixels (o teste re-implementa a leitura: CRC32, inflate stored, Adler-32)
// ---------------------------------------------------------------------------

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
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

interface Png {
  width: number
  height: number
  /** Um byte por pixel (grayscale), já sem os bytes de filtro. */
  pixels: Uint8Array
}

function readPng(base64: string): Png {
  const bytes = new Uint8Array(Buffer.from(base64, 'base64'))
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  let at = 8
  let width = 0
  let height = 0
  const idat: number[] = []
  const seen: string[] = []

  while (at < bytes.length) {
    const len = view.getUint32(at, false)
    const type = new TextDecoder().decode(bytes.slice(at + 4, at + 8))
    const data = bytes.slice(at + 8, at + 8 + len)
    const declared = view.getUint32(at + 8 + len, false)

    // O CRC32 cobre o tipo + os dados do chunk.
    expect(crc32(bytes.slice(at + 4, at + 8 + len))).toBe(declared)

    seen.push(type)
    if (type === 'IHDR') {
      width = view.getUint32(at + 8, false)
      height = view.getUint32(at + 12, false)
      expect(data[8]).toBe(8) // bit depth 8
      expect(data[9]).toBe(0) // grayscale
      expect(data[10]).toBe(0) // deflate
      expect(data[11]).toBe(0) // filtro adaptativo
      expect(data[12]).toBe(0) // sem interlace
    } else if (type === 'IDAT') {
      idat.push(...data)
    }
    at += 12 + len
  }

  expect(seen[0]).toBe('IHDR')
  expect(seen.at(-1)).toBe('IEND')

  const raw = inflateIdat(new Uint8Array(idat))

  // Desfaz o filtro (só usamos o filtro 0 = None) e joga fora o byte de filtro.
  expect(raw.length).toBe(height * (width + 1))
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    expect(raw[y * (width + 1)]).toBe(0)
    pixels.set(raw.subarray(y * (width + 1) + 1, y * (width + 1) + 1 + width), y * width)
  }

  return { width, height, pixels }
}

/**
 * Desempacota o IDAT. Usa o inflate do runtime, de propósito: ele é escrito por
 * outra gente, então não tem como errar junto com o nosso deflate. E ainda cobra
 * o Adler-32, que um zlib inválido não passaria.
 */
function inflateIdat(stream: Uint8Array): Uint8Array {
  const cmf = stream[0]!
  const flg = stream[1]!
  expect(cmf & 0x0f).toBe(8) // método = deflate
  expect(((cmf << 8) | flg) % 31).toBe(0) // checksum do header zlib

  // Descasca o envelope zlib: 2 bytes de header, 4 de Adler-32 no fim. O miolo é
  // deflate cru, que é o que Bun.inflateSync consome.
  const raw = Bun.inflateSync(new Uint8Array(stream.subarray(2, stream.length - 4)))

  const declared =
    ((stream[stream.length - 4]! << 24) |
      (stream[stream.length - 3]! << 16) |
      (stream[stream.length - 2]! << 8) |
      stream[stream.length - 1]!) >>>
    0
  expect(adler32(raw)).toBe(declared)

  return raw
}

// ---------------------------------------------------------------------------
// pixels → matriz de módulos
// ---------------------------------------------------------------------------

function matrixFromPng(png: Png, scale: number, quiet: number): boolean[][] {
  const size = png.width / scale - quiet * 2
  expect(Number.isInteger(size)).toBe(true)
  expect(png.width).toBe(png.height)

  // A quiet zone tem que estar toda clara, senão o scanner não acha o símbolo.
  for (let y = 0; y < quiet * scale; y++) {
    for (let x = 0; x < png.width; x++) expect(png.pixels[y * png.width + x]).toBe(0xff)
  }

  const modules: boolean[][] = []
  for (let r = 0; r < size; r++) {
    const row: boolean[] = []
    for (let c = 0; c < size; c++) {
      // Amostra o centro do módulo, como um leitor faria.
      const y = (quiet + r) * scale + Math.floor(scale / 2)
      const x = (quiet + c) * scale + Math.floor(scale / 2)
      row.push(png.pixels[y * png.width + x] === 0x00)
    }
    modules.push(row)
  }
  return modules
}

// ---------------------------------------------------------------------------
// Decodificador de QR (lado da leitura)
// ---------------------------------------------------------------------------

/** Tabela de centros de alignment publicada na ISO/IEC 18004 (anexo E). */
const PUBLISHED_ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
}

/** Onde ficam as function patterns — é o que um leitor precisa saber para pular. */
function functionMap(version: number): boolean[][] {
  const size = moduleCount(version)
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const mark = (r: number, c: number): void => {
    if (r >= 0 && r < size && c >= 0 && c < size) fn[r]![c] = true
  }

  for (let i = 0; i < size; i++) {
    mark(6, i)
    mark(i, 6)
  }
  for (const [r0, c0] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ] as const) {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) mark(r0 + dr, c0 + dc)
  }
  const centers = PUBLISHED_ALIGNMENT[version]!
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      const last = centers.length - 1
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(centers[i]! + dr, centers[j]! + dc)
    }
  }
  for (let i = 0; i <= 8; i++) {
    mark(8, i)
    mark(i, 8)
  }
  for (let i = 0; i < 8; i++) {
    mark(8, size - 1 - i)
    mark(size - 1 - i, 8)
  }
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      mark(b, a)
      mark(a, b)
    }
  }
  return fn
}

const MASK_FNS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

/** Lê o format info da 1ª cópia, confere o BCH e devolve nível de EC + máscara. */
function readFormat(modules: boolean[][]): { ecLevel: number; mask: number } {
  const bit = (r: number, c: number): number => (modules[r]![c]! ? 1 : 0)

  let raw = 0
  for (let i = 0; i <= 5; i++) raw |= bit(i, 8) << i
  raw |= bit(7, 8) << 6
  raw |= bit(8, 8) << 7
  raw |= bit(8, 7) << 8
  for (let i = 9; i < 15; i++) raw |= bit(8, 14 - i) << i

  const unmasked = raw ^ 0x5412
  const data = unmasked >>> 10

  // Confere o BCH(15,5): o resto tem que bater com os 10 bits baixos.
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  expect(rem & 0x3ff).toBe(unmasked & 0x3ff)

  return { ecLevel: data >>> 3, mask: data & 0b111 }
}

// GF(256) — só para checar as síndromes do Reed-Solomon.
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!
}
const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!)

/** Um bloco RS é válido quando todas as síndromes são zero. */
function syndromesAreZero(block: number[], ecCount: number): boolean {
  for (let j = 0; j < ecCount; j++) {
    let value = 0
    for (const coeff of block) value = mul(value, EXP[j]!) ^ coeff
    if (value !== 0) return false
  }
  return true
}

interface Decoded {
  version: number
  ecLevel: number
  mask: number
  text: string
}

function decode(modules: boolean[][]): Decoded {
  const size = modules.length
  const version = (size - 17) / 4
  expect(Number.isInteger(version)).toBe(true)

  const { ecLevel, mask } = readFormat(modules)
  const fn = functionMap(version)
  const unmask = MASK_FNS[mask]!

  // Zigue-zague de baixo-direita para cima, pulando a coluna 6.
  const bits: number[] = []
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step
      for (const col of [right, right - 1]) {
        if (fn[row]![col]) continue
        const dark = modules[row]![col]! !== unmask(row, col)
        bits.push(dark ? 1 : 0)
      }
    }
    upward = !upward
  }

  const stream: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b]!
    stream.push(byte)
  }
  expect(stream.length).toBe(totalCodewords(version))

  // De-interleave: reconstrói os blocos e confere o RS de cada um.
  const [ecPerBlock, g1, d1, g2, d2] = EC_BLOCKS_M[version]!
  const sizes = [...Array<number>(g1).fill(d1), ...Array<number>(g2).fill(d2)]
  const dataBlocks: number[][] = sizes.map(() => [])
  const ecBlocks: number[][] = sizes.map(() => [])

  let at = 0
  for (let i = 0; i < Math.max(d1, d2); i++) {
    for (let b = 0; b < sizes.length; b++) {
      if (i < sizes[b]!) dataBlocks[b]!.push(stream[at++]!)
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < sizes.length; b++) ecBlocks[b]!.push(stream[at++]!)
  }
  expect(at).toBe(totalCodewords(version))

  for (let b = 0; b < sizes.length; b++) {
    const full = [...dataBlocks[b]!, ...ecBlocks[b]!]
    expect(syndromesAreZero(full, ecPerBlock)).toBe(true)
  }

  // Bits de dados → modo, contador, bytes.
  const dataBits: number[] = []
  for (const block of dataBlocks) {
    for (const byte of block) for (let b = 7; b >= 0; b--) dataBits.push((byte >>> b) & 1)
  }
  const take = (n: number): number => {
    let value = 0
    for (let i = 0; i < n; i++) value = (value << 1) | dataBits.shift()!
    return value
  }

  expect(take(4)).toBe(0b0100) // byte mode
  const length = take(version < 10 ? 8 : 16)
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) bytes[i] = take(8)

  return { version, ecLevel, mask, text: new TextDecoder().decode(bytes) }
}

// ---------------------------------------------------------------------------

describe('qrcode: tabelas conferidas contra a norma (encoder e decoder poderiam errar juntos)', () => {
  it('bate com os totais de codewords publicados', () => {
    // ISO/IEC 18004, tabela 1 — codewords totais por versão.
    const PUBLISHED = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346]
    for (let v = 1; v <= 10; v++) expect(totalCodewords(v)).toBe(PUBLISHED[v - 1]!)
  })

  it('bate com a capacidade publicada de byte mode no nível M', () => {
    const PUBLISHED = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213]
    for (let v = 1; v <= 10; v++) expect(capacityBytes(v)).toBe(PUBLISHED[v - 1]!)
  })

  it('os codewords totais batem com a GEOMETRIA da matriz', () => {
    // Prova independente da tabela: conta os módulos que sobram depois das
    // function patterns. Devem ser 8·codewords + os remainder bits da versão.
    const REMAINDER = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0]
    for (let v = 1; v <= 10; v++) {
      const fn = functionMap(v)
      let free = 0
      for (const row of fn) for (const isFn of row) if (!isFn) free++
      expect(free).toBe(totalCodewords(v) * 8 + REMAINDER[v - 1]!)
    }
  })

  it('a tabela de EC é internamente consistente', () => {
    for (let v = 1; v <= 10; v++) {
      const [ec, g1, d1, g2, d2] = EC_BLOCKS_M[v]!
      if (g2 > 0) expect(d2).toBe(d1 + 1) // o grupo 2 tem exatamente 1 dado a mais
      expect(g1 * d1 + g2 * d2 + (g1 + g2) * ec).toBe(totalCodewords(v))
    }
  })

  it('os centros de alignment batem com a tabela publicada', () => {
    for (let v = 1; v <= 10; v++) expect(alignmentCenters(v)).toEqual(PUBLISHED_ALIGNMENT[v]!)
  })

  it('o format info bate com a tabela C.1 da norma (nível M, máscaras 0..7)', () => {
    const PUBLISHED = [
      '101010000010010',
      '101000100100101',
      '101111001111100',
      '101101101001011',
      '100010111111001',
      '100000011001110',
      '100111110010111',
      '100101010100000',
    ]
    for (let mask = 0; mask < 8; mask++) {
      expect(formatBits(mask).toString(2).padStart(15, '0')).toBe(PUBLISHED[mask]!)
    }
  })

  it('o version info bate com a tabela D.1 da norma (v7..v10)', () => {
    const PUBLISHED: Record<number, string> = {
      7: '000111110010010100',
      8: '001000010110111100',
      9: '001001101010011001',
      10: '001010010011010011',
    }
    for (const [v, bits] of Object.entries(PUBLISHED)) {
      expect(versionBits(Number(v)).toString(2).padStart(18, '0')).toBe(bits)
    }
  })
})

describe('qrMatrix: estrutura', () => {
  const modules = qrMatrix(PIX_PAYLOAD)
  const size = modules.length
  const version = (size - 17) / 4

  it('escolhe a menor versão que cabe', () => {
    expect(chooseVersion(PIX_PAYLOAD.length)).toBe(version)
    expect(capacityBytes(version)).toBeGreaterThanOrEqual(PIX_PAYLOAD.length)
    if (version > 1) expect(capacityBytes(version - 1)).toBeLessThan(PIX_PAYLOAD.length)
  })

  it('tem finder pattern nas 3 quinas (e nenhum na 4ª)', () => {
    const isFinder = (r0: number, c0: number): boolean => {
      for (let dr = 0; dr < 7; dr++) {
        for (let dc = 0; dc < 7; dc++) {
          const ring = dr === 0 || dr === 6 || dc === 0 || dc === 6
          const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
          if (modules[r0 + dr]![c0 + dc] !== (ring || core)) return false
        }
      }
      return true
    }
    expect(isFinder(0, 0)).toBe(true)
    expect(isFinder(0, size - 7)).toBe(true)
    expect(isFinder(size - 7, 0)).toBe(true)
    expect(isFinder(size - 7, size - 7)).toBe(false)
  })

  it('tem separadores claros ao redor dos finders', () => {
    for (let i = 0; i < 8; i++) {
      expect(modules[7]![i]).toBe(false)
      expect(modules[i]![7]).toBe(false)
      expect(modules[7]![size - 1 - i]).toBe(false)
      expect(modules[size - 1 - i]![7]).toBe(false)
    }
  })

  it('tem timing pattern alternado nas linha/coluna 6', () => {
    for (let i = 8; i < size - 8; i++) {
      expect(modules[6]![i]).toBe(i % 2 === 0)
      expect(modules[i]![6]).toBe(i % 2 === 0)
    }
  })

  it('tem o dark module em (4v+9, 8)', () => {
    expect(modules[4 * version + 9]![8]).toBe(true)
  })

  it('declara nível de correção M no format info', () => {
    const { ecLevel, mask } = readFormat(modules)
    expect(ecLevel).toBe(0b00) // M
    expect(mask).toBeGreaterThanOrEqual(0)
    expect(mask).toBeLessThan(8)
  })

  it('escreve as DUAS cópias do format info com os mesmos bits', () => {
    const bit = (r: number, c: number): number => (modules[r]![c]! ? 1 : 0)
    const first: number[] = []
    for (let i = 0; i <= 5; i++) first.push(bit(i, 8))
    first.push(bit(7, 8), bit(8, 8), bit(8, 7))
    for (let i = 9; i < 15; i++) first.push(bit(8, 14 - i))

    const second: number[] = []
    for (let i = 0; i < 8; i++) second.push(bit(8, size - 1 - i))
    for (let i = 8; i < 15; i++) second.push(bit(size - 15 + i, 8))

    expect(second).toEqual(first)
  })
})

describe('qrMatrix: decodifica de volta (é isto que prova que escaneia)', () => {
  it('devolve exatamente o payload Pix real', () => {
    const decoded = decode(qrMatrix(PIX_PAYLOAD))
    expect(decoded.text).toBe(PIX_PAYLOAD)
    expect(decoded.ecLevel).toBe(0b00) // M
  })

  it('faz o round-trip em todas as faixas de versão (v1..v10)', () => {
    // Um payload por versão: o tamanho exato da capacidade daquela versão.
    for (let v = 1; v <= 10; v++) {
      const payload = 'A'.repeat(capacityBytes(v))
      const decoded = decode(qrMatrix(payload))
      expect(decoded.version).toBe(v)
      expect(decoded.text).toBe(payload)
    }
  })

  it('faz o round-trip de payloads variados', () => {
    const cases = [
      'x',
      'https://pix.asaas.com/qr/cobv/618c88aa-7beb-4abf-ad17-4213dc8fa380',
      '0'.repeat(100),
      'pay_1234567890 R$ 1,99',
      // 213 bytes = o teto absoluto do nosso suporte (v10, nível M).
      'Z'.repeat(213),
    ]
    for (const payload of cases) {
      expect(decode(qrMatrix(payload)).text).toBe(payload)
    }
  })

  it('lança quando o payload passa do teto de 213 bytes', () => {
    expect(() => qrMatrix('Z'.repeat(214))).toThrow(/213/)
  })
})

describe('qrcode: a fronteira de capacidade, em bytes de Pix de verdade', () => {
  // O teto (213 bytes, v10/M) não é abstrato: um BR Code o alcança. Estes números
  // são o orçamento real — se um deles estourar, o handler de Pix vira um 500.
  it('cobre o BR Code real do sandbox com folga', () => {
    expect(PIX_PAYLOAD.length).toBe(184)
    expect(chooseVersion(PIX_PAYLOAD.length)).toBe(10)
    expect(capacityBytes(10) - PIX_PAYLOAD.length).toBeGreaterThanOrEqual(29)
  })

  it('cobre o pior caso com URL do Asaas + nome/cidade no máximo (198 bytes)', () => {
    expect(() => qrMatrix('x'.repeat(198))).not.toThrow()
  })

  it('NÃO cobre URL do Asaas + txid longo (220 bytes) — o limite conhecido', () => {
    // Um txid de 25 chars junto de uma URL de 60 estoura a v10. O handler hoje usa
    // txid `***` e URL curta (172 bytes no pior caso), então não chega perto — mas
    // se alguém passar um txid real, é aqui que quebra, e é preciso suportar v11+.
    expect(() => qrMatrix('x'.repeat(220))).toThrow(/não cabem/)
  })
})

describe('qrPng', () => {
  it('devolve base64 cujo prefixo é a assinatura PNG', () => {
    const b64 = qrPng(PIX_PAYLOAD)
    const bytes = Buffer.from(b64, 'base64')
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from('\x89PNG\r\n\x1a\n', 'binary'))
    // Sem o prefixo `data:` — o campo `encodedImage` do Asaas é base64 puro.
    expect(b64.startsWith('data:')).toBe(false)
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('o PNG, lido de volta, dá a MESMA matriz que qrMatrix', () => {
    const png = readPng(qrPng(PIX_PAYLOAD, { scale: 6, quietZone: 4 }))
    expect(matrixFromPng(png, 6, 4)).toEqual(qrMatrix(PIX_PAYLOAD))
  })

  it('o PNG do payload Pix real decodifica de volta para o payload', () => {
    const png = readPng(qrPng(PIX_PAYLOAD, { scale: 8, quietZone: 4 }))
    const decoded = decode(matrixFromPng(png, 8, 4))
    expect(decoded.text).toBe(PIX_PAYLOAD)
  })

  it('tem quiet zone de 4 módulos e escala configurável', () => {
    const png = readPng(qrPng(PIX_PAYLOAD, { scale: 4, quietZone: 4 }))
    const size = qrMatrix(PIX_PAYLOAD).length
    expect(png.width).toBe((size + 8) * 4)
    expect(png.height).toBe(png.width)
  })

  it('é determinístico', () => {
    expect(qrPng(PIX_PAYLOAD)).toBe(qrPng(PIX_PAYLOAD))
  })
})
