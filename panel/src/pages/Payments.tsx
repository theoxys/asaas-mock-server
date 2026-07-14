/**
 * As cobranças da conta selecionada — lidas da API v3 REAL, com a chave dela.
 *
 * Ler pelo `/v3` em vez de por uma porta de admin não é purismo: é o que garante que o
 * que você vê na tela é EXATAMENTE o que o seu código vai receber. Uma tela que lesse o
 * banco direto poderia mostrar um campo que o serializer não emite, e você gastaria uma
 * tarde procurando um `creditDate` que a API nunca mandou.
 *
 * O botão "simular pagamento" é a única coisa aqui que não é do Asaas — e vai pela rota
 * de sandbox (`/v3/sandbox/payment/{id}/confirm`), com a chave da conta.
 */
import { useEffect, useState } from 'preact/hooks'
import { v3, type Payment } from '../api.ts'
import type { PageProps } from '../app.tsx'
import { DataTable, type Column } from '../components/DataTable.tsx'
import { Button, Card, Empty, money, StatusBadge } from '../components/ui.tsx'

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

  /**
   * `value` devolve o dado CRU. É por isso que ordenar por "Valor" compara números e
   * não a string "R$ 1.000,00" — onde R$ 90 viria depois de R$ 1.000.
   */
  const columns: Column<Payment>[] = [
    { key: 'id', header: 'ID', render: (p) => <span class="mono">{p.id}</span>, value: (p) => p.id },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
      value: (p) => p.status,
    },
    { key: 'billingType', header: 'Tipo', render: (p) => p.billingType, value: (p) => p.billingType },
    {
      key: 'value',
      header: 'Valor',
      align: 'right',
      render: (p) => money(p.value),
      value: (p) => p.value,
    },
    {
      key: 'netValue',
      header: 'Líquido',
      align: 'right',
      render: (p) => <span class="hint">{money(p.netValue)}</span>,
      value: (p) => p.netValue,
    },
    { key: 'dueDate', header: 'Vencimento', render: (p) => p.dueDate, value: (p) => p.dueDate },
    {
      key: 'paymentDate',
      header: 'Pago em',
      render: (p) => p.paymentDate ?? '—',
      value: (p) => p.paymentDate,
    },
    {
      key: 'creditDate',
      header: 'Crédito',
      render: (p) => p.creditDate ?? '—',
      value: (p) => p.creditDate,
    },
    {
      key: 'externalReference',
      header: 'Referência',
      render: (p) => <span class="mono hint">{p.externalReference ?? '—'}</span>,
      value: (p) => p.externalReference,
    },
  ]

  return (
    <Card flush>
      <DataTable
        rows={rows}
        columns={columns}
        initialSort={{ key: 'dueDate', dir: 'desc' }}
        searchPlaceholder="Buscar por id, status, tipo, referência…"
        empty='nenhuma cobrança nesta conta — use "Simular Venda" para criar uma'
        actions={(p) =>
          PAYABLE.has(p.status) && (
            <Button
              size="sm"
              variant="primary"
              disabled={busy === p.id}
              title="Confirma o pagamento pela rota de sandbox do Asaas — como se o cliente tivesse pago."
              onClick={() => void confirm(p)}
            >
              {busy === p.id ? '…' : 'Simular pagamento'}
            </Button>
          )
        }
      />
    </Card>
  )
}
