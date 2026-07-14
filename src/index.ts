import { bootstrap } from './bootstrap.ts'
import { OPERATION_COUNT } from './generated/operations.ts'

const { app, config, seed, coverage, scheduler } = await bootstrap()

scheduler.start(config.clock.tickIntervalMs)

app.listen(config.port)

// Denominador é o total de ROTAS, não de operações: 5 operações da spec dividem
// rota com a canônica (a variante "com cartão de crédito"). Ver progress.md.
const routable = OPERATION_COUNT - coverage.variants.length
const pct = Math.round((coverage.implemented.length / routable) * 100)

console.log(`
┌─ Asaas Mock Server ──────────────────────────────────────────
│  API         http://localhost:${config.port}/v3
${
  config.adminEnabled
    ? `│  Painel      http://localhost:${config.port}   ← contas, saldos e viagem no tempo`
    : `│  Painel      desligado (ADMIN_ENABLED=false)`
}
│
│  Cobertura   ${coverage.implemented.length}/${routable} operações (${pct}%) — as demais respondem 501
│  Relógio     ${config.clock.mode}${config.clock.tickIntervalMs > 0 ? ` · tick a cada ${config.clock.tickIntervalMs}ms` : ' · timer desligado'}
│  Banco       ${config.databasePath}
│
│  Conta       ${seed.accountId}${seed.created ? '  (criada agora)' : ''}
│  walletId    ${seed.walletId}
│  API key     ${seed.apiKey}
${
  config.webhook.localhostRewrite
    ? `│
│  Webhooks apontados para localhost são reescritos para
│  "${config.webhook.localhostRewrite}" — é assim que o evento sai do
│  container e chega na sua máquina. Ajuste com WEBHOOK_LOCALHOST_REWRITE.`
    : `│
│  Reescrita de localhost DESLIGADA. Se estiver rodando em Docker, um
│  webhook para localhost vai bater no próprio container e nunca chegar
│  em você. Defina WEBHOOK_LOCALHOST_REWRITE=host.docker.internal.`
}
└──────────────────────────────────────────────────────────────
`)

const shutdown = () => {
  console.log('\nEncerrando…')
  scheduler.stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
