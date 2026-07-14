/**
 * Publica `docs/dockerhub-overview.md` como a página do repositório no Docker Hub.
 *
 * Existe porque o overview do Hub é um campo num banco de dados deles, não um
 * arquivo — e um texto que só vive lá vira, em três meses, uma versão fóssil do
 * README que ninguém lembra de atualizar. Aqui ele é versionado com o código, e
 * republicar é um comando.
 *
 *   bun run hub:overview
 *
 * Autentica com o PAT que já está no `docker login` (keychain no macOS,
 * `~/.docker/config.json` no Linux). O token precisa do escopo **repo:admin** —
 * "Read, Write, Delete" na tela de Personal Access Tokens. Um PAT de
 * "Read & Write" empurra imagem mas NÃO edita metadados: a API devolve
 * `403 insufficient scope`, e nada na mensagem diz que o problema é o escopo do
 * token e não a sua permissão no repositório.
 */
const IMAGE = process.env.IMAGE ?? 'mpiresdev/asaas-mock-server'
const [namespace, repo] = IMAGE.split('/')

/** O Hub trunca em 100 bytes e recusa o resto com um 400 pouco óbvio. */
const DESCRIPTION =
  'A local Asaas that delivers webhooks to localhost. Virtual clock: D+32 in 40ms.'

const MAX_DESCRIPTION_BYTES = 100

async function credentials(): Promise<{ username: string; secret: string }> {
  const registry = 'https://index.docker.io/v1/'

  // O helper de credenciais é o mesmo que o `docker` usa; ler o config.json à mão
  // não funcionaria, porque com `credsStore` o segredo não está lá.
  const store =
    process.platform === 'darwin' ? 'docker-credential-osxkeychain' : 'docker-credential-secretservice'

  const p = Bun.spawn([store, 'get'], { stdin: new TextEncoder().encode(registry), stdout: 'pipe' })
  const out = await new Response(p.stdout).text()
  if ((await p.exited) !== 0) {
    throw new Error(`sem credencial do Docker Hub — rode \`docker login -u ${namespace}\``)
  }
  const c = JSON.parse(out)
  return { username: c.Username, secret: c.Secret }
}

async function main() {
  const body = await Bun.file(new URL('../docs/dockerhub-overview.md', import.meta.url)).text()

  const bytes = new TextEncoder().encode(DESCRIPTION).length
  if (bytes > MAX_DESCRIPTION_BYTES) {
    throw new Error(`description tem ${bytes} bytes; o Hub aceita ${MAX_DESCRIPTION_BYTES}`)
  }

  const { username, secret } = await credentials()

  const login = await fetch('https://hub.docker.com/v2/users/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: secret }),
  })
  const { token } = (await login.json()) as { token?: string }
  if (!token) throw new Error('login no Docker Hub falhou')

  const r = await fetch(`https://hub.docker.com/v2/repositories/${namespace}/${repo}/`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ description: DESCRIPTION, full_description: body }),
  })

  if (r.status === 403) {
    throw new Error(
      'o Docker Hub recusou: o PAT precisa do escopo "Read, Write, Delete" (repo:admin).\n' +
        'Gere um novo em Account Settings → Personal access tokens e refaça o `docker login`.',
    )
  }
  if (!r.ok) throw new Error(`Docker Hub ${r.status}: ${await r.text()}`)

  console.log(`✓ overview publicado em https://hub.docker.com/r/${namespace}/${repo}`)
  console.log(`  ${body.length} caracteres`)
}

await main()
