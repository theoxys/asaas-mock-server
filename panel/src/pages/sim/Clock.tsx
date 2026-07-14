/**
 * A viagem no tempo. É o que este simulador tem que o sandbox do Asaas não tem.
 *
 * Avançar 32 dias em milissegundos e ver o `PAYMENT_RECEIVED` de um cartão chegar é
 * a razão de o projeto existir. Mas o relógio é GLOBAL AO CONTAINER — ele move o tempo
 * para a aplicação que integra do outro lado também. Clicar `+32` aqui e depois
 * estranhar que "o Pix nasce OVERDUE" no seu app é o mesmo bug, e ele custou uma tarde.
 *
 * Por isso o aviso vive no shell, visível em qualquer tela, e não escondido aqui.
 */
import { useState } from 'preact/hooks'
import { admin } from '../../api.ts'
import type { PageProps } from '../../app.tsx'
import { Badge, Banner, Button, Card, plural, Row } from '../../components/ui.tsx'

const STEPS = [
  { days: 1, label: '+1 dia' },
  { days: 7, label: '+7 dias' },
  { days: 32, label: '+32 dias', hint: 'o prazo de crédito de um cartão' },
]

export function Clock({ store }: PageProps) {
  const [busy, setBusy] = useState(false)
  const c = store.clock
  const drift = c?.driftDays ?? 0

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      await store.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const advance = (days: number) =>
    run(() => admin('/clock/advance', { method: 'POST', body: JSON.stringify({ days }) }))

  return (
    <div class="stack">
      <Banner tone="primary" icon="ⓘ">
        Nada nesta página existe na API do Asaas. O relógio é <b>global ao container</b>:
        mover o tempo aqui move o tempo para a aplicação que está integrando do outro
        lado — cobranças novas passam a nascer vencidas.
      </Banner>

      <Card title="Relógio do simulador">
        <Row label="Agora">
          <b class="mono">{c?.now ?? '…'}</b>
        </Row>
        <Row label="Modo">
          <Badge tone={c?.mode === 'REAL' ? 'neutral' : 'primary'}>{c?.mode ?? '…'}</Badge>
        </Row>
        <Row label="Desvio do tempo real">
          {drift === 0 ? (
            <Badge tone="success">no presente</Badge>
          ) : drift > 0 ? (
            <Badge tone="danger">{plural(drift, 'dia à frente', 'dias à frente')}</Badge>
          ) : (
            <Badge tone="warn">{plural(-drift, 'dia atrás', 'dias atrás')}</Badge>
          )}
        </Row>
      </Card>

      <Card
        title="Avançar"
        subtitle="Cada dia simulado roda um TICK COMPLETO — assinaturas geram cobrança, vencidos viram OVERDUE, cartões creditam. Não é um salto só."
      >
        <div class="row">
          {STEPS.map((s) => (
            <Button
              key={s.days}
              disabled={busy || c?.mode === 'REAL'}
              title={s.hint}
              onClick={() => void advance(s.days)}
            >
              {s.label}
            </Button>
          ))}
          <Button
            disabled={busy}
            onClick={() => void run(() => admin('/tick', { method: 'POST' }))}
            title="Roda os jobs sem mexer no relógio. Útil para drenar a fila de webhooks."
          >
            Tick
          </Button>
          <Button
            variant="primary"
            disabled={busy || drift === 0}
            onClick={() => void run(() => admin('/clock/reset', { method: 'POST' }))}
          >
            Voltar ao presente
          </Button>
        </div>

        {c?.mode === 'REAL' && (
          <p class="hint" style={{ marginBottom: 0, marginTop: 'var(--pad-md)' }}>
            O relógio está em modo <code>REAL</code>. Suba o container com{' '}
            <code>CLOCK_MODE=VIRTUAL_FLOWING</code> para poder viajar no tempo.
          </p>
        )}
      </Card>
    </div>
  )
}
