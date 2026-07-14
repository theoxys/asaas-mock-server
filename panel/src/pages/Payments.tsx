/**
 * As cobranças da conta selecionada — lidas da API v3 REAL, com a chave dela.
 *
 * Ler pelo `/v3` em vez de por uma porta de admin não é purismo: é o que garante que
 * o que você vê na tela é EXATAMENTE o que o seu código vai receber. Uma tela que
 * lesse o banco direto poderia mostrar um campo que o serializer não emite, e você
 * gastaria uma tarde procurando um `creditDate` que a API nunca mandou.
 *
 * O botão "confirmar pagamento" é a única coisa aqui que não é do Asaas — e vai pela
 * rota de sandbox (`/v3/sandbox/payment/{id}/confirm`), com a chave da conta, marcado
 * como simulação.
 */
import { useEffect, useState } from 'preact/hooks'
import { v3, type Payment } from '../api.ts'
import type { PageProps } from '../app.tsx'
import { Button, Card, Empty, money, StatusBadge, Table } from '../components/ui.tsx'

/** Os status em que faz sentido oferecer "pagar". Fora deles, o botão some. */
const PAYABLE = new Set(['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS'])

export function Payments({ store }: PageProps) {
  const [rows, setRows] = useState<Payment[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const key = store.selected?.apiKey

  const load = async () => {
    if (!key) return
    setRows(null)
    const r = await v3('/payments?limit=100&order=desc', key)
    setRows(r.data)
  }

  useEffect(() => {
    void load()
  }, [key])

  const confirm = async (p: Payment) => {
    if (!key) return
    setBusy(p.id)
    try {
      await v3(`/sandbox/payment/${p.id}/confirm`, key, { method: 'POST' })
      await load()
      await store.reload() // o saldo mudou, e a topbar mostra o saldo
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  if (!rows) return <Card><Empty>carregando…</Empty></Card>
  if (rows.length === 0) {
    return (
      <Card>
        <Empty>nenhuma cobrança nesta conta — use "Simular Venda" para criar uma</Empty>
      </Card>
    )
  }

  return (
    <Card subtitle={`${rows.length} cobrança(s) nesta conta`} flush>
      <Table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Líquido</th>
            <th>Vencimento</th>
            <th>Pago em</th>
            <th>Crédito</th>
            <th>Referência</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td class="mono">{p.id}</td>
              <td><StatusBadge status={p.status} /></td>
              <td>{p.billingType}</td>
              <td>{money(p.value)}</td>
              <td class="hint">{money(p.netValue)}</td>
              <td>{p.dueDate}</td>
              <td>{p.paymentDate ?? '—'}</td>
              <td>{p.creditDate ?? '—'}</td>
              <td class="mono hint">{p.externalReference ?? '—'}</td>
              <td>
                {PAYABLE.has(p.status) && (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy === p.id}
                    title="Confirma o pagamento pela rota de sandbox do Asaas — como se o cliente tivesse pago."
                    onClick={() => void confirm(p)}
                  >
                    {busy === p.id ? '…' : 'Simular pagamento'}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}
