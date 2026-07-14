/**
 * "Simular Venda" — o caminho mais curto entre abrir o painel e ter algo acontecendo.
 *
 * Cria cliente e cobrança pela API v3 REAL, com a chave da conta. Cada campo aqui é um
 * campo que o seu código vai preencher; não há atalho nenhum por baixo. O que o painel
 * faz em dois cliques, o seu backend faz em duas chamadas — as mesmas.
 *
 * O split é opcional e vai para a carteira de uma subconta, porque é o único jeito de
 * ver, sem escrever código, o dinheiro sair de uma conta e entrar na outra com os dois
 * extratos fechando.
 */
import { useState } from 'preact/hooks'
import { v3 } from '../api.ts'
import * as I from '../icons.ts'
import { Icon } from '../components/Icon.tsx'
import { Badge, Button, money } from '../components/ui.tsx'
import type { Store } from '../store.ts'
import './SimulateSale.css'

const BILLING = ['PIX', 'BOLETO', 'CREDIT_CARD'] as const

/** A data de hoje do SIMULADOR — não a da máquina. Se o relógio viajou, ele manda. */
const dueFrom = (today: string, days: number) => {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function SimulateSale({ store, onClose }: { store: Store; onClose: () => void }) {
  const [billingType, setBillingType] = useState<(typeof BILLING)[number]>('PIX')
  const [value, setValue] = useState('100,00')
  const [dueDays, setDueDays] = useState(3)
  const [splitTo, setSplitTo] = useState('')
  const [splitPct, setSplitPct] = useState('10')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const key = store.selected?.apiKey
  const today = store.clock?.today ?? new Date().toISOString().slice(0, 10)
  const subs = store.accounts.filter((a) => a.parentAccountId && a.id !== store.selected?.id)

  const cents = Number(value.replace(/\./g, '').replace(',', '.')) || 0

  const submit = async () => {
    if (!key || cents <= 0) return
    setBusy(true)
    try {
      const customer = await v3('/customers', key, {
        method: 'POST',
        body: JSON.stringify({ name: 'Cliente Simulado', cpfCnpj: '24971563792' }),
      })

      const split = splitTo
        ? [
            {
              walletId: store.accounts.find((a) => a.id === splitTo)!.walletId,
              percentualValue: Number(splitPct) || 0,
            },
          ]
        : undefined

      const payment = await v3('/payments', key, {
        method: 'POST',
        body: JSON.stringify({
          customer: customer.id,
          billingType,
          value: cents,
          dueDate: dueFrom(today, dueDays),
          description: 'Venda simulada pelo painel',
          ...(split ? { split } : {}),
        }),
      })

      setDone(payment.id)
      await store.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div class="modal-scrim" onClick={onClose} />
      <div class="modal" role="dialog" aria-label="Simular venda">
        <header>
          <h2>Simular Venda</h2>
          <button class="modal-x" onClick={onClose} aria-label="Fechar">
            <Icon icon={I.CLOSE} size={18} />
          </button>
        </header>

        {done ? (
          <div class="modal-body">
            <p>
              Cobrança <b class="mono">{done}</b> criada em{' '}
              <b>{store.selected?.name}</b>.
            </p>
            <p class="hint">
              Ela está em <b>Cobranças</b>. Se for PIX ou BOLETO, use "Simular pagamento"
              lá para confirmá-la — e veja o <code>PAYMENT_RECEIVED</code> sair na fila de
              webhooks.
            </p>
            <div class="modal-actions">
              <Button onClick={() => setDone(null)}>Criar outra</Button>
              <Button variant="primary" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div class="modal-body">
            <label>
              <span>Meio de pagamento</span>
              <div class="row">
                {BILLING.map((b) => (
                  <button
                    key={b}
                    class={`chip ${billingType === b ? 'on' : ''}`}
                    onClick={() => setBillingType(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </label>

            <label>
              <span>Valor</span>
              <input
                class="input"
                value={value}
                onInput={(e) => setValue((e.target as HTMLInputElement).value)}
              />
            </label>

            <label>
              <span>Vencimento</span>
              <div class="row">
                {[0, 3, 7, 30].map((d) => (
                  <button
                    key={d}
                    class={`chip ${dueDays === d ? 'on' : ''}`}
                    onClick={() => setDueDays(d)}
                  >
                    {d === 0 ? 'hoje' : `+${d}d`}
                  </button>
                ))}
                <span class="hint">{dueFrom(today, dueDays)}</span>
              </div>
            </label>

            {subs.length > 0 && (
              <label>
                <span>Split (opcional)</span>
                <div class="row">
                  <select
                    class="input"
                    value={splitTo}
                    onChange={(e) => setSplitTo((e.target as HTMLSelectElement).value)}
                  >
                    <option value="">sem split</option>
                    {subs.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  {splitTo && (
                    <>
                      <input
                        class="input pct"
                        value={splitPct}
                        onInput={(e) => setSplitPct((e.target as HTMLInputElement).value)}
                      />
                      <span class="hint">%</span>
                    </>
                  )}
                </div>
              </label>
            )}

            <div class="modal-summary">
              <Badge tone="primary">{billingType}</Badge>
              <b>{money(cents)}</b>
              <span class="hint">
                em <b>{store.selected?.name}</b>, vencendo {dueFrom(today, dueDays)}
              </span>
            </div>

            <div class="modal-actions">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={busy || cents <= 0 || !key}
                onClick={() => void submit()}
              >
                {busy ? 'Criando…' : 'Criar cobrança'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
