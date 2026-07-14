/**
 * Split — as duas pontas, lado a lado. É a tela que justifica o multiconta.
 *
 * "Recebidos" é dinheiro que ENTRA nesta conta porque outra a incluiu num split.
 * "Pagos" é dinheiro que SAI dela para outra. Trocar de conta no seletor da topbar e
 * ver o mesmo split aparecer do outro lado, com o sinal invertido, é o único jeito de
 * confirmar que o dinheiro andou de verdade — e não só que a API respondeu 200.
 *
 * `BLOCKED_BY_VALUE_DIVERGENCE` é o estado que morde: a soma dos splits passou do
 * netValue e o Asaas BLOQUEIA em vez de rejeitar a cobrança, dando 2 dias úteis para
 * ajustar. Um split que nunca credita, sem erro nenhum, é exatamente isto.
 */
import { useEffect, useState } from 'preact/hooks'
import { v3 } from '../api.ts'
import type { PageProps } from '../app.tsx'
import { DataTable, type Column } from '../components/DataTable.tsx'
import { Badge, Card, Empty, money, type Tone } from '../components/ui.tsx'

interface Split {
  id: string
  paymentId?: string
  walletId?: string
  status: string
  totalValue: number | null
  fixedValue: number | null
  percentualValue: number | null
  description: string | null
  refusalReason?: string | null
  cancellationReason?: string | null
}

const TONE: Record<string, Tone> = {
  DONE: 'success',
  AWAITING_CREDIT: 'primary',
  PENDING: 'warn',
  BLOCKED_BY_VALUE_DIVERGENCE: 'danger',
  REFUSED: 'danger',
  CANCELLED: 'neutral',
}

function SplitTable({ rows, empty }: { rows: Split[]; empty: string }) {
  const columns: Column<Split>[] = [
    {
      key: 'paymentId',
      header: 'Cobrança',
      render: (s) => <span class="mono">{s.paymentId ?? '—'}</span>,
      value: (s) => s.paymentId,
    },
    {
      key: 'walletId',
      header: 'Carteira',
      render: (s) => <span class="mono hint">{s.walletId?.slice(0, 8) ?? '—'}…</span>,
      value: (s) => s.walletId,
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => <Badge tone={TONE[s.status] ?? 'neutral'}>{s.status}</Badge>,
      value: (s) => s.status,
    },
    {
      key: 'rule',
      header: 'Regra',
      render: (s) => (
        <span class="hint">
          {s.percentualValue != null
            ? `${s.percentualValue}%`
            : s.fixedValue != null
              ? money(s.fixedValue)
              : '—'}
        </span>
      ),
      // Percentual e fixo não são comparáveis entre si. Ordenar por esta coluna
      // misturaria "10%" com "R$ 50" e produziria uma ordem sem significado.
    },
    {
      key: 'totalValue',
      header: 'Valor',
      align: 'right',
      render: (s) => money(s.totalValue),
      value: (s) => s.totalValue,
    },
  ]

  return (
    <DataTable
      rows={rows}
      columns={columns}
      initialSort={{ key: 'totalValue', dir: 'desc' }}
      searchPlaceholder="Buscar por cobrança, carteira, status…"
      empty={empty}
    />
  )
}

export function Splits({ store }: PageProps) {
  const [received, setReceived] = useState<Split[] | null>(null)
  const [paid, setPaid] = useState<Split[] | null>(null)
  const key = store.selected?.apiKey

  useEffect(() => {
    if (!key) return
    setReceived(null)
    setPaid(null)
    void v3('/payments/splits/received?limit=100', key).then((r) => setReceived(r.data))
    void v3('/payments/splits/paid?limit=100', key).then((r) => setPaid(r.data))
  }, [key])

  return (
    <div class="stack">
      <Card
        title="Splits recebidos"
        subtitle="Dinheiro que ENTRA nesta conta porque outra a incluiu num split."
        flush
      >
        {received ? (
          <SplitTable rows={received} empty="nenhum split recebido" />
        ) : (
          <Empty>carregando…</Empty>
        )}
      </Card>

      <Card
        title="Splits pagos"
        subtitle="Dinheiro que SAI desta conta para outra carteira."
        flush
      >
        {paid ? <SplitTable rows={paid} empty="nenhum split pago" /> : <Empty>carregando…</Empty>}
      </Card>
    </div>
  )
}
