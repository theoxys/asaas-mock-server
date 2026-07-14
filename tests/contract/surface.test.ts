/**
 * Teste de superfície: as 213 operações da spec do Asaas EXISTEM.
 *
 * É o teste que transforma "cobertura total da API" de promessa em invariante.
 * Se o Asaas publicar uma operação nova, o codegen a traz para o manifesto, ela
 * aparece aqui, e o teste continua passando — respondendo 501 em vez de 404.
 * O que ele proíbe é uma rota da spec sumir do roteamento.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  getOperation,
  OPERATION_COUNT,
  OPERATION_IDS,
} from '../../src/generated/operations.ts'
import { createHarness, TEST_API_KEY, type Harness } from '../helpers/harness.ts'

let h: Harness

beforeAll(async () => {
  h = await createHarness()
})
afterAll(() => h.close())

describe('superfície da API', () => {
  it('o manifesto tem as 213 operações da spec', () => {
    expect(OPERATION_IDS.length).toBe(OPERATION_COUNT)
    expect(OPERATION_COUNT).toBe(213)
  })

  it('toda operação resolve para uma rota — nenhuma cai em 404 de roteamento', async () => {
    const routingFailures: string[] = []

    for (const id of OPERATION_IDS) {
      const op = getOperation(id)

      // Preenche os parâmetros com um valor qualquer: aqui só interessa se a
      // ROTA existe, não se o recurso existe.
      let path: string = op.specPath
      for (const name of op.paramNames ?? []) path = path.replace(`{${name}}`, 'x')

      const res = await h.app.app.handle(
        new Request(`http://localhost${path}`, {
          method: op.method.toUpperCase(),
          headers: { access_token: TEST_API_KEY, 'content-type': 'application/json' },
          ...(op.body ? { body: '{}' } : {}),
        }),
      )

      // 404 só é aceitável vindo do handler (recurso inexistente), nunca do
      // router — que devolve a mensagem de endpoint inexistente.
      if (res.status === 404) {
        const body = (await res.clone().json()) as any
        const desc: string = body?.errors?.[0]?.description ?? ''
        if (desc.includes('não existe na API do Asaas')) {
          routingFailures.push(`${op.method.toUpperCase()} ${op.specPath} (${id})`)
        }
      }
    }

    expect(routingFailures).toEqual([])
  })

  it('operações sem handler devolvem 501 no formato de erro do Asaas', async () => {
    // A operação é escolhida DINAMICAMENTE entre as que ainda não têm handler —
    // senão este teste quebraria a cada track entregue, o que seria um alarme
    // falso e treinaria todo mundo a ignorá-lo.
    const stubbed = h.app.coverage.stubbed.find((id) => {
      const op = getOperation(id)
      return op.method === 'get' && !op.paramNames?.length && !op.query
    })
    expect(stubbed).toBeDefined()

    const op = getOperation(stubbed!)
    const res = await h.app.app.handle(
      new Request(`http://localhost${op.specPath}`, {
        headers: { access_token: TEST_API_KEY },
      }),
    )

    expect(res.status).toBe(501)
    const body = (await res.json()) as any
    expect(body.errors[0].code).toBe('not_implemented')
    // A mensagem diz QUAL operação falta — é o que torna o 501 acionável.
    expect(body.errors[0].description).toContain(stubbed!)
  })

  it('toda operação do manifesto é registrada, é variante, ou é ambas as contas', () => {
    const { implemented, stubbed, variants } = h.app.coverage
    expect(implemented.length + stubbed.length + variants.length).toBe(OPERATION_COUNT)
  })

  it('as variantes apontam para uma operação canônica que existe', () => {
    // Ex.: "criar cobrança com cartão" divide POST /v3/payments com "criar
    // cobrança" — no Asaas real é o mesmo endpoint, e o body decide.
    const variants = OPERATION_IDS.map(getOperation).filter((o) => o.variantOf)
    expect(variants.length).toBe(5)

    for (const v of variants) {
      const canonical = getOperation(v.variantOf as never)
      expect(canonical).toBeDefined()
      expect(canonical.variantOf).toBeUndefined() // sem cadeia de variantes
      expect(canonical.method).toBe(v.method)
      expect(canonical.path).toBe(v.path)
    }
  })
})
