import { describe, expect, it } from 'bun:test'
import { isValidCnpj, isValidCpf, isValidCpfCnpj, personTypeOf } from '../../src/domain/cpf-cnpj.ts'

describe('cpf/cnpj', () => {
  it('valida CPF pelo dígito verificador', () => {
    expect(isValidCpf('24971563792')).toBe(true)
    expect(isValidCpf('249.715.637-92')).toBe(true) // aceita formatado
    expect(isValidCpf('24971563793')).toBe(false) // DV errado
    expect(isValidCpf('12345678901')).toBe(false)
  })

  it('rejeita CPF com todos os dígitos iguais', () => {
    // Passam no algoritmo mas são inválidos por convenção — e o Asaas rejeita.
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('00000000000')).toBe(false)
  })

  it('valida CNPJ pelo dígito verificador', () => {
    expect(isValidCnpj('47960950000121')).toBe(true)
    expect(isValidCnpj('47.960.950/0001-21')).toBe(true)
    expect(isValidCnpj('47960950000122')).toBe(false)
    expect(isValidCnpj('11111111111111')).toBe(false)
  })

  it('rejeita documento com tamanho inválido', () => {
    expect(isValidCpfCnpj('123')).toBe(false)
    expect(isValidCpfCnpj('')).toBe(false)
  })

  it('deriva personType do tamanho do documento', () => {
    expect(personTypeOf('24971563792')).toBe('FISICA')
    expect(personTypeOf('47960950000121')).toBe('JURIDICA')
  })
})
