/**
 * Regressão: o merge de config precisa ser PROFUNDO nos objetos aninhados.
 *
 * Um spread raso já quebrou de verdade aqui. Passar `webhook: { timeoutMs: 500 }`
 * apagava `retentionDays` junto, e o erro não aparecia na config — aparecia três
 * camadas adiante, na hora de inserir uma entrega:
 *
 *     NOT NULL constraint failed: webhook_deliveries.expires_at_ms
 *
 * porque `now + undefined * DAY_MS` é NaN. Este teste existe para que ninguém
 * "simplifique" o merge de volta para um spread.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { bootstrap, type App } from '../../src/bootstrap.ts'
import { cents } from '../../src/domain/money.ts'

let app: App | undefined
afterEach(() => app?.close())

describe('merge de config', () => {
  it('override parcial de objeto aninhado preserva os irmãos', async () => {
    app = await bootstrap({
      config: {
        databasePath: ':memory:',
        logLevel: 'silent',
        webhook: { timeoutMs: 500 }, // <- só UM campo dos cinco
      },
    })

    expect(app.config.webhook.timeoutMs).toBe(500)

    // Os irmãos sobrevivem — é o ponto inteiro do teste.
    expect(app.config.webhook.retentionDays).toBeGreaterThan(0)
    expect(app.config.webhook.maxAttempts).toBeGreaterThan(0)
    expect(app.config.webhook.maxPerAccount).toBeGreaterThan(0)
  })

  it('override parcial da tabela de taxas preserva as demais taxas', async () => {
    app = await bootstrap({
      config: {
        databasePath: ':memory:',
        logLevel: 'silent',
        fees: { pix: 0 as never }, // simulando uma conta sem taxa de Pix
      },
    })

    // `Cents` é um tipo marcado (branded): comparar com o número cru não compila.
    expect(app.config.fees.pix).toBe(cents(0))
    expect(app.config.fees.boleto).toBe(cents(199)) // intacta
    expect(app.config.fees.creditCard.fixed).toBe(cents(49)) // o objeto aninhado também
  })
})
