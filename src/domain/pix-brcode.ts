/**
 * BR Code EMV — o payload "copia e cola" do Pix. PURO.
 *
 * Formato EMV®QRCPS / Manual de Padrões do BACEN: TLV com ID de 2 dígitos,
 * tamanho de 2 dígitos zero-padded e CRC16-CCITT nos 4 hex finais.
 *
 * Este é um QR **dinâmico**: o valor NÃO vai no payload (não existe campo `54`) —
 * ele mora atrás da URL do campo 26/25. Foi verificado contra um payload real do
 * sandbox, cujo CRC (`C50D`) é o golden de `tests/unit/pix-brcode.test.ts`.
 */

/** Campo 26, subcampo 00: o GUI do arranjo Pix. */
const PIX_GUI = 'br.gov.bcb.pix'

const MERCHANT_NAME_MAX = 25
const MERCHANT_CITY_MAX = 15

export interface BrCodeInput {
  /** URL do payload dinâmico (campo 26/25). O esquema `https://` é removido. */
  url: string
  merchantName: string
  merchantCity: string
  /** Campo 62/05. O padrão para QR dinâmico é `***`. */
  txid?: string
  /** Campo 61 (CEP, só dígitos). Omitido quando ausente. */
  postalCode?: string
}

/**
 * CRC16-CCITT (poly 0x1021, init 0xFFFF, sem xor final), 4 hex maiúsculos.
 * Calculado sobre os bytes ASCII do payload já com o `6304` no fim.
 */
export function crc16(s: string): string {
  let crc = 0xffff
  for (let i = 0; i < s.length; i++) {
    crc ^= (s.charCodeAt(i) & 0xff) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Um TLV: `<id 2><len 2 zero-padded><value>`. */
function tlv(id: string, value: string): string {
  if (value.length > 99) {
    throw new Error(`brCode: campo ${id} tem ${value.length} chars — o tamanho TLV só vai até 99`)
  }
  return id + String(value.length).padStart(2, '0') + value
}

/** O BR Code é ASCII: acento vira letra sem acento, o resto some. */
function ascii(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim()
    .slice(0, max)
}

export function brCodePayload(i: BrCodeInput): string {
  const url = i.url.replace(/^https?:\/\//i, '')
  const txid = i.txid && i.txid.length > 0 ? i.txid : '***'

  const merchantAccount = tlv('00', PIX_GUI) + tlv('25', url)

  let payload =
    tlv('00', '01') + // payload format indicator
    tlv('01', '12') + // point of initiation: 12 = dinâmico (uso único)
    tlv('26', merchantAccount) +
    tlv('52', '0000') + // merchant category code: não informado
    tlv('53', '986') + // moeda: BRL
    tlv('58', 'BR') +
    tlv('59', ascii(i.merchantName, MERCHANT_NAME_MAX)) +
    tlv('60', ascii(i.merchantCity, MERCHANT_CITY_MAX))

  if (i.postalCode) {
    const digits = i.postalCode.replace(/\D/g, '')
    if (digits.length > 0) payload += tlv('61', digits)
  }

  payload += tlv('62', tlv('05', txid))
  payload += '6304' // o CRC entra depois — mas o "6304" já entra no cálculo dele.

  return payload + crc16(payload)
}

/** Confere o CRC de um BR Code recebido pronto. Útil em teste e em depuração. */
export function isValidBrCode(payload: string): boolean {
  if (payload.length < 8) return false
  const body = payload.slice(0, -4)
  if (!body.endsWith('6304')) return false
  return crc16(body) === payload.slice(-4).toUpperCase()
}
