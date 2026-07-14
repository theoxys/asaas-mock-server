/**
 * A pegadinha nº 1 do projeto — e a razão de ele existir.
 *
 * O sandbox do Asaas não entrega webhook em `localhost`. Este servidor entrega.
 * Só que ele roda DENTRO de um container: ali, `localhost` é o próprio container,
 * e um POST para `http://localhost:3000/webhook` bateria no nada — ou, pior, no
 * próprio simulador.
 *
 * O dev configura o webhook com a URL que ele enxerga da máquina dele
 * (`http://localhost:3000/webhook`); nós reescrevemos o HOST para
 * `host.docker.internal` (WEBHOOK_LOCALHOST_REWRITE) na hora de entregar. Porta,
 * path, query e fragmento são preservados — só o host muda.
 *
 * Fora do Docker, `WEBHOOK_LOCALHOST_REWRITE` fica vazio e nada é reescrito: é
 * o caso dos testes, onde o sink de verdade escuta em localhost.
 */

/** Os nomes que, dentro de um container, apontam para o container. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'])

export type Logger = (
  level: 'debug' | 'info' | 'warn' | 'error',
  msg: string,
  data?: unknown,
) => void

/** Loga a PRIMEIRA reescrita e só ela: o resto viraria ruído a cada entrega. */
let announced = false

/** Só para os testes — o estado de "já avisei" é global de processo. */
export function resetRewriteNotice(): void {
  announced = false
}

/**
 * Reescreve o host de uma URL de loopback para `target`.
 *
 * `target === undefined` → não reescreve (não estamos em Docker).
 * URL inválida → devolve a string original; quem falha é o `fetch`, com o erro
 * real registrado na entrega. Não é aqui que se descobre que a URL é inválida.
 */
export function rewriteForContainer(
  url: string,
  target: string | undefined,
  log?: Logger,
): string {
  if (!target) return url

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  if (!LOOPBACK.has(parsed.hostname) && !LOOPBACK.has(parsed.host)) return url

  const original = parsed.host // host = hostname + porta, e a porta a gente mantém
  parsed.hostname = target
  const rewritten = parsed.toString()

  if (!announced) {
    announced = true
    log?.(
      'info',
      `Webhook apontado para ${original}: reescrevendo o host para "${target}". ` +
        `Dentro do container, "localhost" é o próprio container — sem isto o ` +
        `webhook nunca chegaria na sua máquina. (WEBHOOK_LOCALHOST_REWRITE)`,
      { from: url, to: rewritten },
    )
  }

  return rewritten
}
