/**
 * Um endpoint de webhook de verdade, num servidor HTTP de verdade.
 *
 * Poderia ser um espião em memória, mas então não estaríamos testando nada do
 * que importa: o `fetch`, o timeout de 10s, o header `asaas-access-token`, e a
 * regra de que SÓ HTTP 200 conta como sucesso. É justamente aí que as
 * integrações quebram no mundo real.
 */
type BunServer = ReturnType<typeof Bun.serve>

export interface ReceivedWebhook {
  payload: any
  headers: Record<string, string>
  receivedAtMs: number
}

export class WebhookSink {
  #server: BunServer
  readonly received: ReceivedWebhook[] = []

  /** Respostas programadas, consumidas uma a uma. Depois volta ao default. */
  #queued: (number | 'timeout')[] = []
  #default: number | 'timeout' = 200

  private constructor(server: BunServer) {
    this.#server = server
  }

  static async start(): Promise<WebhookSink> {
    let sink: WebhookSink
    const server = Bun.serve({
      port: 0, // porta efêmera — testes rodam em paralelo sem colidir
      async fetch(req) {
        const payload = await req.json().catch(() => null)
        const headers: Record<string, string> = {}
        req.headers.forEach((v, k) => {
          headers[k] = v
        })

        sink.received.push({ payload, headers, receivedAtMs: Date.now() })

        const outcome = sink.#queued.shift() ?? sink.#default

        if (outcome === 'timeout') {
          // Nunca responde. Exercita o AbortSignal.timeout do dispatcher.
          await new Promise(() => {})
        }

        return new Response('ok', { status: outcome as number })
      },
    })
    sink = new WebhookSink(server)
    return sink
  }

  get url(): string {
    return `http://localhost:${this.#server.port}/webhook`
  }

  /** Todas as respostas seguintes usam este status. 200 = sucesso. */
  respondWith(status: number | 'timeout'): void {
    this.#default = status
  }

  /** As próximas `n` respostas falham com `status`; depois volta ao default. */
  failNext(n: number, status: number | 'timeout' = 500): void {
    for (let i = 0; i < n; i++) this.#queued.push(status)
  }

  eventsOf(event: string): ReceivedWebhook[] {
    return this.received.filter((r) => r.payload?.event === event)
  }

  /** Ordem em que os eventos chegaram — o teste de SEQUENTIALLY vive disso. */
  get eventNames(): string[] {
    return this.received.map((r) => r.payload?.event)
  }

  clear(): void {
    this.received.length = 0
    this.#queued.length = 0
    this.#default = 200
  }

  stop(): void {
    this.#server.stop(true)
  }
}
