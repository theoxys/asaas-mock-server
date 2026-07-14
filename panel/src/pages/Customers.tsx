import { useEffect, useState } from 'preact/hooks'
import { v3 } from '../api.ts'
import type { PageProps } from '../app.tsx'
import { DataTable, type Column } from '../components/DataTable.tsx'
import { Card, Empty } from '../components/ui.tsx'

interface Customer {
  id: string
  name: string
  email: string | null
  cpfCnpj: string
  mobilePhone: string | null
  dateCreated: string
}

export function Customers({ store }: PageProps) {
  const [rows, setRows] = useState<Customer[] | null>(null)
  const key = store.selected?.apiKey

  useEffect(() => {
    if (!key) return
    setRows(null)
    void v3('/customers?limit=100', key).then((r) => setRows(r.data))
  }, [key])

  if (!rows) return <Card><Empty>carregando…</Empty></Card>

  const columns: Column<Customer>[] = [
    { key: 'id', header: 'ID', render: (c) => <span class="mono">{c.id}</span>, value: (c) => c.id },
    { key: 'name', header: 'Nome', render: (c) => c.name, value: (c) => c.name },
    {
      key: 'cpfCnpj',
      header: 'CPF/CNPJ',
      render: (c) => <span class="mono">{c.cpfCnpj}</span>,
      value: (c) => c.cpfCnpj,
    },
    { key: 'email', header: 'E-mail', render: (c) => c.email ?? '—', value: (c) => c.email },
    {
      key: 'mobilePhone',
      header: 'Telefone',
      render: (c) => c.mobilePhone ?? '—',
      value: (c) => c.mobilePhone,
    },
    {
      key: 'dateCreated',
      header: 'Criado em',
      render: (c) => c.dateCreated,
      value: (c) => c.dateCreated,
    },
  ]

  return (
    <Card flush>
      <DataTable
        rows={rows}
        columns={columns}
        initialSort={{ key: 'name', dir: 'asc' }}
        searchPlaceholder="Buscar por nome, CPF/CNPJ, e-mail…"
        empty="nenhum cliente nesta conta"
      />
    </Card>
  )
}
