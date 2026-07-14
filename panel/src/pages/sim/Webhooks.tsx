/**
 * A fila de webhooks — e POR QUE ela não está andando.
 *
 * O motor é fiel demais para ser opaco. Em `SEQUENTIALLY` (o padrão do Asaas), UMA
 * entrega que falha trava TODAS as seguintes: head-of-line blocking de verdade. Nem no
 * Asaas nem aqui alguém grita isso — o sintoma na ponta é "o Asaas diz que o pagamento
 * foi RECEIVED, mas meu pedido continua pendente", e o dev vai caçar o bug na rota de
 * status dele, que está certa.
 *
 * As AÇÕES vão pela API v3 REAL, com a chave do DONO do webhook (cada conta só enxerga
 * os seus — a chave errada devolve 404). Nada aqui te ensina um truque que não existe
 * no Asaas: uma mensagem envenenada só sai consertando o seu endpoint.
 */
import { useState } from 'preact/hooks'
import { admin, v3, type QueueHealth } from '../../api.ts'
import type { PageProps } from '../../app.tsx'
import { Badge, Banner, Button, Card, Empty, Row } from '../../components/ui.tsx'

const WHY: Record<string, string> = {
  INTERRUPTED:
    'A fila foi INTERROMPIDA: a entrega esgotou as 15 tentativas do backoff. O Asaas para de tentar e não volta sozinho.',
  DISABLED: 'O webhook está desativado. Nada é entregue enquanto estiver assim.',
  HEAD_FAILING:
    'A entrega na cabeça da fila está falhando. Em SEQUENTIALLY isso trava todas as seguintes.',
  HEAD_IN_BACKOFF: 'A cabeça da fila está aguardando o backoff. As seguintes esperam com ela.',
}

export function Webhooks({ store }: PageProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const keyOf = new Map(store.accounts.map((a) => [a.id, a.apiKey]))

  const act = async (w: QueueHealth, fn: (key: string) => Promise<unknown>) => {
    const key = keyOf.get(w.accountId)
    if (!key) return
    setBusy(w.webhookId)
    try {
      await fn(key)
      await admin('/tick', { method: 'POST' }) // solta na hora o que destravou
      await store.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  if (store.queues.length === 0) {
    return (
      <Card>
        <Empty>
          nenhum webhook cadastrado — crie um em <code>POST /v3/webhooks</code>
        </Empty>
      </Card>
    )
  }

  return (
    <div class="stack">
      <Banner tone="primary">
        Esta tela é do simulador, mas os <b>botões chamam a API real do Asaas</b>{' '}
        (<code>removeBackoff</code>, <code>PUT /v3/webhooks</code>). Não há botão de
        descartar evento: no Asaas não existe, e uma mensagem envenenada só sai
        consertando o seu endpoint.
      </Banner>

      {store.queues.map((w) => {
        const b = w.blocked
        return (
          <Card
            key={w.webhookId}
            title={w.name}
            subtitle={
              <>
                conta <b>{w.accountName}</b> · <span class="mono">{w.url}</span>
              </>
            }
            actions={
              <>
                <Badge tone={w.sendType === 'SEQUENTIALLY' ? 'primary' : 'neutral'}>
                  {w.sendType}
                </Badge>
                <Badge tone={w.pending > 0 ? 'warn' : 'neutral'}>{w.pending} na fila</Badge>
              </>
            }
          >
            {b && (
              <Banner tone="danger">
                {WHY[b.reason]}
                {b.lastStatusCode ? (
                  <>
                    <br />
                    Último retorno do seu endpoint: <b>HTTP {b.lastStatusCode}</b> no evento{' '}
                    <code>{b.event}</code>, tentativa {b.attempt}. <b>Só HTTP 200 é sucesso</b>{' '}
                    para o Asaas.
                  </>
                ) : b.lastError ? (
                  <>
                    <br />O endpoint <b>não respondeu</b> no evento <code>{b.event}</code>{' '}
                    (tentativa {b.attempt}): <span class="mono">{b.lastError}</span>
                  </>
                ) : null}
                {b.behind > 0 && (
                  <>
                    <br />
                    <b>{b.behind}</b> entrega(s) parada(s) atrás dela.
                  </>
                )}
              </Banner>
            )}

            <Row label="Estado">
              {w.interrupted ? (
                <Badge tone="danger">interrompido</Badge>
              ) : !w.enabled ? (
                <Badge tone="neutral">desativado</Badge>
              ) : b ? (
                <Badge tone="warn">travada</Badge>
              ) : (
                <Badge tone="success">entregando</Badge>
              )}
            </Row>

            <div class="row" style={{ marginTop: 'var(--pad-md)' }}>
              <Button
                variant="primary"
                disabled={busy === w.webhookId}
                title="removeBackoff: zera as tentativas, reagenda tudo para agora e solta a fila."
                onClick={() =>
                  void act(w, (k) =>
                    v3(`/webhooks/${w.webhookId}/removeBackoff`, k, { method: 'POST' }),
                  )
                }
              >
                Reativar fila
              </Button>

              <Button
                disabled={busy === w.webhookId}
                onClick={() =>
                  void act(w, (k) =>
                    v3(`/webhooks/${w.webhookId}`, k, {
                      method: 'PUT',
                      body: JSON.stringify({ enabled: !w.enabled }),
                    }),
                  )
                }
              >
                {w.enabled ? 'Desativar' : 'Ativar'}
              </Button>

              <Button
                variant="ghost"
                disabled={busy === w.webhookId}
                title="NON_SEQUENTIALLY entrega em paralelo: uma falha não segura as outras."
                onClick={() =>
                  void act(w, (k) =>
                    v3(`/webhooks/${w.webhookId}`, k, {
                      method: 'PUT',
                      body: JSON.stringify({
                        sendType:
                          w.sendType === 'SEQUENTIALLY' ? 'NON_SEQUENTIALLY' : 'SEQUENTIALLY',
                      }),
                    }),
                  )
                }
              >
                Trocar para{' '}
                {w.sendType === 'SEQUENTIALLY' ? 'NON_SEQUENTIALLY' : 'SEQUENTIALLY'}
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
