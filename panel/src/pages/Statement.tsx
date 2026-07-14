/**
 * O extrato — e o motivo de ele existir aqui é ser AUDITÁVEL.
 *
 * Cada linha é um lançamento no ledger, e a soma delas TEM que fechar com o saldo
 * mostrado na topbar. É essa a invariante que os testes de integração checam a cada
 * transação (`balance_cents === SUM(financial_transactions.value_cents)`), e é ela que
 * torna possível olhar um split e ver o dinheiro sair de uma conta e entrar na outra.
 */
import { useEffect, useState } from 'preact/hooks'
import { v3 } from '../api.ts'
import type { PageProps } from '../app.tsx'
import { Badge, Card, Empty, money, Table } from '../components/ui.tsx'

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
  if (rows.length === 0) return <Card><Empty>nenhum lançamento nesta conta</Empty></Card>

  return (
    <Card
      subtitle={`Saldo atual: ${money(store.selected?.balance)} — a soma dos lançamentos abaixo fecha com ele.`}
      flush
    >
      <Table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Descrição</th>
            <th>Cobrança</th>
            <th style={{ textAlign: 'right' }}>Valor</th>
            <th style={{ textAlign: 'right' }}>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>{t.date}</td>
              <td>
                <Badge tone={DEBIT.test(t.type) ? 'danger' : 'success'}>{t.type}</Badge>
              </td>
              <td style={{ whiteSpace: 'normal' }}>{t.description ?? '—'}</td>
              <td class="mono hint">{t.paymentId ?? '—'}</td>
              <td
                style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                class={t.value < 0 ? 'neg' : 'pos'}
              >
                {money(t.value)}
              </td>
              <td
                class="hint"
                style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              >
                {money(t.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}
