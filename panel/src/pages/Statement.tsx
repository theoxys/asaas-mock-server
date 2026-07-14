/**
 * O extrato — e o motivo de ele existir aqui é ser AUDITÁVEL.
 *
 * Cada linha é um lançamento no ledger, e a soma delas TEM que fechar com o saldo
 * mostrado na topbar. É essa a invariante que os testes de integração checam a cada
 * transação (`balance_cents === SUM(financial_transactions.value_cents)`), e é ela que
 * torna possível olhar um split e ver o dinheiro sair de uma conta e entrar na outra.
 *
 * A coluna "Saldo" é um acumulado: ordenar por ela ou filtrar a lista NÃO recalcula
 * nada — o número continua sendo o saldo daquele instante, que é o que ele quer dizer.
 */
import { useEffect, useState } from 'preact/hooks'
import { v3 } from '../api.ts'
import type { PageProps } from '../app.tsx'
import { DataTable, type Column } from '../components/DataTable.tsx'
import { Badge, Card, Empty, money } from '../components/ui.tsx'

interface Tx {
  id: string
  value: number
  balance: number
  type: string
  date: string
  description: string | null
  paymentId: string | null
}

/** Os tipos que tiram dinheiro. Pintar todos de verde seria mentir com cor. */
const DEBIT = /FEE|REFUND|TRANSFER|CHARGEBACK|DEBIT|CANCEL/

export function Statement({ store }: PageProps) {
  const [rows, setRows] = useState<Tx[] | null>(null)
  const key = store.selected?.apiKey

  useEffect(() => {
    if (!key) return
    setRows(null)
    void v3('/financialTransactions?limit=100', key).then((r) => setRows(r.data))
  }, [key])

  if (!rows) return <Card><Empty>carregando…</Empty></Card>

  const columns: Column<Tx>[] = [
    { key: 'date', header: 'Data', render: (t) => t.date, value: (t) => t.date },
    {
      key: 'type',
      header: 'Tipo',
      render: (t) => <Badge tone={DEBIT.test(t.type) ? 'danger' : 'success'}>{t.type}</Badge>,
      value: (t) => t.type,
    },
    {
      key: 'description',
      header: 'Descrição',
      render: (t) => <span style={{ whiteSpace: 'normal' }}>{t.description ?? '—'}</span>,
      value: (t) => t.description,
    },
    {
      key: 'paymentId',
      header: 'Cobrança',
      render: (t) => <span class="mono hint">{t.paymentId ?? '—'}</span>,
      value: (t) => t.paymentId,
    },
    {
      key: 'value',
      header: 'Valor',
      align: 'right',
      render: (t) => <span class={t.value < 0 ? 'neg' : 'pos'}>{money(t.value)}</span>,
      value: (t) => t.value,
    },
    {
      key: 'balance',
      header: 'Saldo',
      align: 'right',
      render: (t) => <span class="hint">{money(t.balance)}</span>,
      value: (t) => t.balance,
    },
  ]

  return (
    <Card
      subtitle={`Saldo atual: ${money(store.selected?.balance)} — a soma dos lançamentos abaixo fecha com ele.`}
      flush
    >
      <DataTable
        rows={rows}
        columns={columns}
        initialSort={{ key: 'date', dir: 'desc' }}
        searchPlaceholder="Buscar por tipo, descrição, cobrança…"
        empty="nenhum lançamento nesta conta"
      />
    </Card>
  )
}
