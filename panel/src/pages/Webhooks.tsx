/**
 * Os webhooks DA CONTA SELECIONADA, e por que a fila de cada um não está andando.
 *
 * Webhook é configuração da conta, não do simulador — por isso esta tela mora na
 * navegação do Asaas, e não no bloco do Simulador. Um evento da conta X só é entregue
 * aos webhooks de X, e a chave de X é a única que os enxerga (a de outra conta devolve
 * 404). Mostrar os oito webhooks das oito contas de uma vez, como esta tela fazia,
 * respondia à pergunta errada — e fazia parecer registro duplicado o que era só cada
 * produtor com o seu.
 *
 * O DIAGNÓSTICO da fila é introspecção nossa; o Asaas não te dá isso. Existe porque o
 * motor é fiel demais para ser opaco: em `SEQUENTIALLY` (o padrão do Asaas), UMA entrega
 * que falha trava TODAS as seguintes — head-of-line blocking de verdade. Nem lá nem aqui
 * alguém grita isso, e o sintoma na ponta é "o Asaas diz que o pagamento foi RECEIVED,
 * mas meu pedido continua pendente": você vai caçar o bug na sua rota de status, que
 * está certa.
 *
 * As AÇÕES vão pela API v3 REAL, com a chave da conta. Nada aqui te ensina um truque que
 * não existe no Asaas: uma mensagem envenenada só sai consertando o seu endpoint.
 */
import { useState } from 'preact/hooks'
import { admin, v3, type QueueHealth } from '../api.ts'
import type { PageProps } from '../app.tsx'
import { Badge, Banner, Button, Card, Empty, Row } from '../components/ui.tsx'

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

  /** Só os desta conta. É o recorte que o Asaas faz, e a pergunta que você está fazendo. */
  const queues = store.queues.filter((q) => q.accountId === store.selected?.id)
  const key = store.selected?.apiKey

  const act = async (w: QueueHealth, fn: (key: string) => Promise<unknown>) => {
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

  if (queues.length === 0) {
    return (
      <Card>
        <Empty>
          <b>{store.selected?.name}</b> não tem webhook cadastrado — crie um em{' '}
          <code>POST /v3/webhooks</code> com a chave dela.
        </Empty>
      </Card>
    )
  }

  return (
    <div class="stack">
      <Banner tone="primary">
        Os webhooks são <b>de {store.selected?.name}</b> — cada conta tem os seus, e um
        evento dela só é entregue a eles. Os botões chamam a <b>API real do Asaas</b>{' '}
        (<code>removeBackoff</code>, <code>PUT /v3/webhooks</code>). O diagnóstico da fila
        abaixo é introspecção do simulador: o Asaas não te conta por que ela travou.
      </Banner>

      {queues.map((w) => {
        const b = w.blocked
        return (
          <Card
            key={w.webhookId}
            title={w.name}
            subtitle={<span class="mono">{w.url}</span>}
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
