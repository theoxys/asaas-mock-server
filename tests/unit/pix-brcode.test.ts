/**
 * O golden aqui é um BR Code REAL, capturado do sandbox do Asaas. O CRC dele
 * (`C50D`) é o que prova a implementação do CRC16 contra dado de verdade — um CRC
 * errado gera um "copia e cola" que o app do banco recusa, e nenhum teste de
 * formato pegaria isso.
 */
import { describe, expect, it } from 'bun:test'
import { brCodePayload, crc16, isValidBrCode } from '../../src/domain/pix-brcode.ts'

/** Capturado do sandbox do Asaas. Não "conserte" este valor. */
const REAL =
  '00020101021226820014br.gov.bcb.pix2560pix-h.asaas.com/qr/cobv/618c88aa-7beb-4abf-ad17-4213dc8fa3805204000053039865802BR5919Pr Solucoes Sandbox6007Itajuba61083750228062070503***6304C50D'

describe('crc16 (CCITT, poly 0x1021, init 0xFFFF)', () => {
  it('reproduz o CRC do BR Code real do sandbox', () => {
    // Tudo até e incluindo o "6304" entra no cálculo.
    expect(crc16(REAL.slice(0, -4))).toBe('C50D')
  })

  it('valida o payload real inteiro', () => {
    expect(isValidBrCode(REAL)).toBe(true)
  })

  it('detecta um único caractere trocado', () => {
    const tampered = REAL.replace('Itajuba', 'Itajubb')
    expect(isValidBrCode(tampered)).toBe(false)
  })

  it('sempre devolve 4 hex maiúsculos, zero-padded', () => {
    for (const s of ['', 'a', 'abc', 'x'.repeat(300)]) {
      expect(crc16(s)).toMatch(/^[0-9A-F]{4}$/)
    }
  })
})

describe('brCodePayload', () => {
  it('reproduz o payload real do sandbox byte a byte', () => {
    const payload = brCodePayload({
      url: 'https://pix-h.asaas.com/qr/cobv/618c88aa-7beb-4abf-ad17-4213dc8fa380',
      merchantName: 'Pr Soluções Sandbox', // o acento tem que cair
      merchantCity: 'Itajubá',
      postalCode: '37502-280', // a máscara tem que cair
    })
    expect(payload).toBe(REAL)
  })

  it('gera payload com CRC válido para qualquer entrada', () => {
    const payload = brCodePayload({
      url: 'pix.asaas.com/qr/cobv/abc',
      merchantName: 'Loja Teste',
      merchantCity: 'Sao Paulo',
    })
    expect(isValidBrCode(payload)).toBe(true)
  })

  it('usa *** como txid padrão do QR dinâmico', () => {
    const payload = brCodePayload({ url: 'x.com/a', merchantName: 'N', merchantCity: 'C' })
    expect(payload).toContain('62070503***')
  })

  it('respeita um txid explícito', () => {
    const payload = brCodePayload({
      url: 'x.com/a',
      merchantName: 'N',
      merchantCity: 'C',
      txid: 'PAY123',
    })
    expect(payload).toContain('62100506PAY123') // 62 len10 { 05 len06 "PAY123" }
    expect(isValidBrCode(payload)).toBe(true)
  })

  it('não emite campo 54 (valor) — é QR dinâmico, o valor está na URL', () => {
    const payload = brCodePayload({ url: 'x.com/a', merchantName: 'N', merchantCity: 'C' })
    // O 53 (moeda) é seguido direto pelo 58 (país).
    expect(payload).toContain('53039865802BR')
  })

  it('trunca nome em 25 e cidade em 15 caracteres', () => {
    const payload = brCodePayload({
      url: 'x.com/a',
      merchantName: 'A'.repeat(40),
      merchantCity: 'B'.repeat(40),
    })
    expect(payload).toContain(`5925${'A'.repeat(25)}`)
    expect(payload).toContain(`6015${'B'.repeat(15)}`)
    expect(isValidBrCode(payload)).toBe(true)
  })

  it('omite o campo 61 quando não há CEP', () => {
    const payload = brCodePayload({ url: 'x.com/a', merchantName: 'N', merchantCity: 'C' })
    expect(payload).not.toContain('6108')
  })

  it('emite os TLV com id de 2 dígitos e tamanho zero-padded', () => {
    const payload = brCodePayload({ url: 'x.com/a', merchantName: 'N', merchantCity: 'C' })
    expect(payload.startsWith('000201010212')).toBe(true) // 00 len02 "01" · 01 len02 "12"
    expect(payload).toContain('52040000') // 52 len04 "0000"
  })
})
