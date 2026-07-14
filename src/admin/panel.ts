/**
 * O painel: uma página HTML servida na RAIZ do simulador.
 *
 * Existe porque o valor deste projeto é ver o dinheiro andar — a cobrança
 * confirmar, o saldo mudar em D+32, o split cair na subconta — e até aqui isso só
 * dava para observar com `curl` e uma boa memória. Abrir `localhost:8080` e ver as
 * contas com saldo, com um botão de "+32 dias", é a diferença entre um simulador
 * que funciona e um que se entende.
 *
 * Escolhas, e por quê:
 *
 *   - **HTML único, sem build.** O simulador roda em Docker; uma toolchain de
 *     frontend significaria um segundo estágio de build no Dockerfile para uma tela
 *     de dev. O arquivo é servido como está.
 *
 *   - **Vive atrás de `ADMIN_ENABLED`**, junto com a viagem no tempo. O painel lê
 *     `GET /_admin/accounts`, que devolve as CHAVES DE API de todas as contas — algo
 *     que a API do Asaas jamais faria, e que só é aceitável porque isto é um
 *     simulador de localhost. Com o admin desligado, o painel some junto. É a razão
 *     de o flag existir.
 */
import { Elysia } from 'elysia'
import { join } from 'node:path'
import type { AppContext } from '../core/context.ts'

/**
 * Lido do disco, não embutido no bundle: assim dá para editar o HTML e recarregar
 * a página sem recompilar nada. O cache evita reler a cada request.
 */
let cached: string | null = null

async function html(): Promise<string> {
  cached ??= await Bun.file(join(import.meta.dir, 'ui.html')).text()
  return cached
}

export function panelRoutes(ctx: AppContext) {
  const app = new Elysia({ name: 'panel' })

  // Sem admin não há painel: ele depende inteiramente de /_admin/accounts e
  // /_admin/clock. Um painel que carrega e não funciona é pior que nenhum.
  if (!ctx.config.adminEnabled) return app

  const serve = async () =>
    new Response(await html(), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })

  return app.get('/', serve).get('/_admin/ui', serve)
}
