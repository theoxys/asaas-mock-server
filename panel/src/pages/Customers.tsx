import { useEffect, useState } from 'preact/hooks'
import { v3 } from '../api.ts'
import type { PageProps } from '../app.tsx'
import { Card, Empty, Table } from '../components/ui.tsx'

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
  if (rows.length === 0) return <Card><Empty>nenhum cliente nesta conta</Empty></Card>

  return (
    <Card subtitle={`${rows.length} cliente(s) nesta conta`} flush>
      <Table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>CPF/CNPJ</th>
            <th>E-mail</th>
            <th>Telefone</th>
            <th>Criado em</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td class="mono">{c.id}</td>
              <td>{c.name}</td>
              <td class="mono">{c.cpfCnpj}</td>
              <td>{c.email ?? '—'}</td>
              <td>{c.mobilePhone ?? '—'}</td>
              <td>{c.dateCreated}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}
