/**
 * Validação de CPF/CNPJ com dígito verificador — o Asaas valida de verdade. Um
 * mock que aceita "11111111111" deixa passar um bug que só apareceria em
 * produção.
 *
 * O código de erro é `invalid_object` (não `invalid_cpfCnpj`, como supúnhamos):
 * provado contra o sandbox real, que devolve
 * `{"code":"invalid_object","description":"O CPF/CNPJ informado é inválido."}`.
 */

const onlyDigits = (v: string): string => v.replace(/\D/g, '')

/**
 * O Asaas recusa celular com todos os dígitos iguais — `47999999999` volta
 * `invalid_mobilePhone`. É a mesma convenção do CPF `11111111111`: passa em
 * qualquer checagem de formato, mas é obviamente falso.
 *
 * Provado contra o sandbox: `47996321478` e até `47912345678` (sequencial!) são
 * aceitos; só o dígito repetido é recusado.
 */
export function isValidMobilePhone(raw: string): boolean {
  const phone = onlyDigits(raw)
  if (phone.length < 10 || phone.length > 11) return false

  // A parte após o DDD não pode ser um único dígito repetido.
  const subscriber = phone.slice(2)
  return !new RegExp(`^(\\d)\\1{${subscriber.length - 1}}$`).test(subscriber)
}

export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw)
  if (cpf.length !== 11) return false
  // Todos os dígitos iguais passam no algoritmo mas são inválidos por convenção.
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const digit = (upTo: number): number => {
    let sum = 0
    for (let i = 0; i < upTo; i++) {
      sum += Number(cpf[i]) * (upTo + 1 - i)
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

export function isValidCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw)
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  const digit = (upTo: number): number => {
    let sum = 0
    let weight = upTo - 7
    for (let i = 0; i < upTo; i++) {
      sum += Number(cnpj[i]) * weight
      weight = weight - 1 < 2 ? 9 : weight - 1
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13])
}

export function isValidCpfCnpj(raw: string): boolean {
  const v = onlyDigits(raw)
  if (v.length === 11) return isValidCpf(v)
  if (v.length === 14) return isValidCnpj(v)
  return false
}

/** O Asaas deriva o personType do tamanho do documento. */
export function personTypeOf(raw: string): 'FISICA' | 'JURIDICA' {
  return onlyDigits(raw).length === 14 ? 'JURIDICA' : 'FISICA'
}
