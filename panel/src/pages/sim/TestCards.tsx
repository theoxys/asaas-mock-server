/**
 * Os cartões de teste e o erro que cada um força.
 *
 * A tabela vem do SERVIDOR (`/_admin/test-cards`), que a lê do DOMÍNIO — a MESMA
 * constante que o motor consulta para decidir o desfecho. Se a tela tivesse a sua
 * própria cópia, ela poderia anunciar, com botão de copiar e tudo, um cartão que o
 * motor não honra.
 *
 * `real: false` marca as nossas extensões: números que o Asaas de verdade APROVARIA.
 * Sem essa marca, alguém escreve um teste contra um comportamento que só existe aqui
 * e descobre em produção.
 */
import { useEffect, useState } from 'preact/hooks'
import { admin, type AsaasError, type TestCard } from '../../api.ts'
import { Badge, Banner, Card, Copy, Empty, Table, type Tone } from '../../components/ui.tsx'
import './TestCards.css'

interface Trigger {
  label: string
  how: string
  error: AsaasError
}

const TONE: Record<string, Tone> = {
  APPROVE: 'success',
  DECLINE: 'danger',
  DECLINE_ON_CHARGE: 'warn',
  EXPIRED: 'danger',
  INVALID_NUMBER: 'danger',
}

const group = (n: string) => n.replace(/(\d{4})(?=\d)/g, '$1 ')

/** O grid de cartões da home. Compacto, com o número pronto para colar. */
export function TestCardList({ compact = false }: { compact?: boolean }) {
  const [cards, setCards] = useState<TestCard[] | null>(null)

  useEffect(() => {
    void admin('/test-cards').then((r) => setCards(r.cards))
  }, [])

  if (!cards) return <Empty>carregando…</Empty>

  return (
    <div class="card-grid">
      {cards.map((c) => (
        <div class="test-card" key={c.number}>
          <div class="test-card-hdr">
            <Badge solid tone="neutral">
              {c.brand}
            </Badge>
            <Badge solid tone={TONE[c.outcome] ?? 'neutral'}>
              {c.label}
            </Badge>
          </div>

          <div class="test-card-fields">
            <span class="f-label">Número</span>
            <Copy value={c.number}>{group(c.number)}</Copy>

            <span class="f-label">Nome</span>
            <Copy value="TESTE SANDBOX" />

            <span class="f-label">Validade</span>
            <Copy value="12/2030" />

            <span class="f-label">CVV</span>
            <Copy value="123" />
          </div>

          {!compact && c.error && (
            <div class="test-card-err">
              <code>{c.error.code}</code> — {c.error.description}
            </div>
          )}

          {!c.real && (
            <div class="test-card-warn" title="No Asaas de verdade este número seria APROVADO.">
              só existe no simulador
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function TestCards() {
  const [triggers, setTriggers] = useState<Trigger[] | null>(null)

  useEffect(() => {
    void admin('/test-cards').then((r) => setTriggers(r.triggers))
  }, [])

  return (
    <div class="stack">
      <Banner tone="primary" icon="ⓘ">
        <b>Qualquer número bem-formado aprova</b> — o Asaas não valida Luhn, e nós também
        não. Os números abaixo forçam desfechos específicos, para você conseguir tratar
        cada erro no seu código.
      </Banner>

      <Card title="Cartões de teste">
        <TestCardList />
      </Card>

      <Card
        title="Erros que não vêm do número"
        subtitle="Três dos erros do Asaas são propriedades de outros campos. Aqui vai como produzi-los."
        flush
      >
        {!triggers ? (
          <Empty>carregando…</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Erro</th>
                <th>Como disparar</th>
                <th>code</th>
                <th>Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((t) => (
                <tr key={t.label}>
                  <td>{t.label}</td>
                  <td><code>{t.how}</code></td>
                  <td><code>{t.error.code}</code></td>
                  <td style={{ whiteSpace: 'normal' }}>{t.error.description}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
