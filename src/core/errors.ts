/**
 * Erros no formato exato do Asaas:
 *
 *   { "errors": [ { "code": "invalid_value", "description": "..." } ] }
 *
 * Sempre um ARRAY — mesmo com um erro só. Descrições em pt-BR.
 *
 * Não existe catálogo oficial de códigos. O padrão real é `invalid_<campo>`,
 * em camelCase igual ao nome do campo do request.
 */

export interface AsaasErrorItem {
  code: string
  description: string
}

export class AsaasError extends Error {
  readonly status: number
  readonly errors: AsaasErrorItem[]

  constructor(status: number, errors: AsaasErrorItem[]) {
    super(errors[0]?.description ?? 'Erro')
    this.name = 'AsaasError'
    this.status = status
    this.errors = errors
  }

  toResponseBody() {
    return { errors: this.errors }
  }
}

/** 400 — o caso mais comum. `invalid_<campo>`. */
export function invalid(field: string, description: string): AsaasError {
  return new AsaasError(400, [{ code: `invalid_${field}`, description }])
}

export function badRequest(code: string, description: string): AsaasError {
  return new AsaasError(400, [{ code, description }])
}

export function unauthorized(): AsaasError {
  return new AsaasError(401, [
    {
      code: 'invalid_access_token',
      description: 'A chave de API fornecida é inválida.',
    },
  ])
}

export function invalidTokenFormat(): AsaasError {
  return new AsaasError(401, [
    {
      code: 'invalid_access_token_format',
      description: 'O formato da chave de API fornecida é inválido.',
    },
  ])
}

export function notFound(what = 'Objeto'): AsaasError {
  return new AsaasError(404, [
    { code: 'not_found', description: `${what} não encontrado.` },
  ])
}

export function forbidden(description = 'Requisição não autorizada.'): AsaasError {
  return new AsaasError(403, [{ code: 'forbidden', description }])
}

/**
 * Rota que existe na spec mas ainda não tem motor de negócio aqui.
 *
 * O Asaas real nunca devolve 501 — mas devolver 404 seria mentir (a rota
 * existe) e devolver dado falso seria pior ainda: produziria falsa confiança,
 * que é exatamente o que um mock não pode fazer. O código é auto-explicativo e o
 * `operationId` diz o que falta implementar.
 */
export function notImplemented(operationId: string): AsaasError {
  return new AsaasError(501, [
    {
      code: 'not_implemented',
      description:
        `A operação "${operationId}" existe na API do Asaas mas ainda não foi ` +
        `implementada neste simulador. Veja progress.md.`,
    },
  ])
}

/** Transição de status não permitida pela máquina de estados. */
export function invalidStatusTransition(from: string, action: string): AsaasError {
  return badRequest(
    'invalid_action',
    `Não é possível executar "${action}" em um objeto com status ${from}.`,
  )
}
