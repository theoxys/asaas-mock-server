/**
 * As subcontas, com a chave de API de cada uma na tela.
 *
 * No Asaas, a chave de uma subconta aparece UMA vez, na resposta da criação, e nunca
 * mais. Quem não guardou, refaz a conta. Aqui ela fica visível — é a razão de o painel
 * ter valor e de `ADMIN_ENABLED` existir.
 *
 * Clicar em "Entrar" troca a conta ativa na topbar: o painel inteiro passa a ver o
 * simulador pelos olhos dela, e você confirma que uma subconta NÃO enxerga as
 * cobranças do pai — que é o comportamento real, e o que uma tela sem isolamento
 * esconderia.
 */
import { useState } from 'preact/hooks'
import { v3 } from '../api.ts'
import type { PageProps } from '../app.tsx'
import { DataTable, type Column } from '../components/DataTable.tsx'
import type { Account } from '../api.ts'
import { Button, Card, Copy, money } from '../components/ui.tsx'

export function Subaccounts({ store }: PageProps) {
  const subs = store.accounts.filter((a) => a.parentAccountId)
  const master = store.accounts.find((a) => !a.parentAccountId)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const create = async () => {
    if (!master?.apiKey || !name.trim()) return
    setCreating(true)
    try {
      // Um CPF válido fixo: a tela não pede o que o simulador não usa para nada.
      await v3('/accounts', master.apiKey, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: `${name.trim().toLowerCase().replace(/\W+/g, '.')}@localhost`,
          cpfCnpj: '24971563792',
          mobilePhone: '11999999999',
          incomeValue: 5000,
          address: 'Rua Exemplo',
          addressNumber: '100',
          province: 'Centro',
          postalCode: '01310100',
        }),
      })
      setName('')
      await store.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  const columns: Column<Account>[] = [
    { key: 'name', header: 'Nome', render: (a) => a.name, value: (a) => a.name },
    {
      key: 'walletId',
      header: 'walletId',
      render: (a) => <Copy value={a.walletId}>{`${a.walletId.slice(0, 8)}…`}</Copy>,
      value: (a) => a.walletId,
    },
    {
      key: 'apiKey',
      header: 'Chave de API',
      render: (a) =>
        a.apiKey ? <Copy value={a.apiKey}>{`${a.apiKey.slice(0, 18)}…`}</Copy> : '—',
      value: (a) => a.apiKey,
    },
    {
      key: 'balance',
      header: 'Saldo',
      align: 'right',
      render: (a) => <span class={a.balance < 0 ? 'neg' : ''}>{money(a.balance)}</span>,
      value: (a) => a.balance,
    },
  ]

  return (
    <div class="stack">
      <Card title="Nova subconta">
        <div class="row">
          <input
            class="input"
            placeholder="Nome da subconta (ex: Produtora Alfa)"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
          />
          <Button variant="primary" disabled={creating || !name.trim()} onClick={() => void create()}>
            {creating ? 'Criando…' : 'Criar'}
          </Button>
        </div>
        <p class="hint" style={{ marginTop: 'var(--pad-sm)', marginBottom: 0 }}>
          Criada pela API real (<code>POST /v3/accounts</code>), com a chave da conta
          principal. Ela nasce com walletId e chave próprios, e saldo zero.
        </p>
      </Card>

      <Card flush>
        <DataTable
          rows={subs}
          columns={columns}
          initialSort={{ key: 'name', dir: 'asc' }}
          searchPlaceholder="Buscar por nome, walletId, chave…"
          empty="nenhuma subconta ainda"
          actions={(a) => (
            <Button size="sm" onClick={() => store.select(a.id)}>
              Entrar
            </Button>
          )}
        />
      </Card>
    </div>
  )
}
