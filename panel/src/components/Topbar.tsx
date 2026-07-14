/**
 * Saldo à esquerda, seletor de conta à direita — o cabeçalho do painel do Asaas.
 *
 * O seletor é a coisa mais útil desta tela e não tem equivalente no Asaas real:
 * lá, entrar numa subconta exige a chave dela, guardada na criação e nunca mais
 * mostrada. Aqui você troca no dropdown e passa a ver o simulador PELOS OLHOS
 * daquela conta — é a única forma de ver, num split, o dinheiro sair de uma e
 * entrar na outra, com os dois extratos fechando.
 */
import { useState } from 'preact/hooks'
import type { Account } from '../api.ts'
import { useTheme } from '../theme.ts'
import { money } from './ui.tsx'
import './Topbar.css'

export function Topbar(props: {
  accounts: Account[]
  selected: Account | null
  onSelect: (id: string) => void
  onRefresh: () => void
  refreshing: boolean
}) {
  const [open, setOpen] = useState(false)
  const [theme, toggleTheme] = useTheme()
  const { selected } = props

  const initial = (selected?.name ?? '?').charAt(0).toUpperCase()
  const master = props.accounts.filter((a) => !a.parentAccountId)
  const subs = props.accounts.filter((a) => a.parentAccountId)

  const option = (a: Account) => (
    <button
      key={a.id}
      class={`acct-option ${a.id === selected?.id ? 'active' : ''}`}
      onClick={() => {
        props.onSelect(a.id)
        setOpen(false)
      }}
    >
      <span class="acct-avatar">{a.name.charAt(0).toUpperCase()}</span>
      <span class="acct-option-name">{a.name}</span>
      <span class={`acct-option-bal ${a.balance < 0 ? 'neg' : ''}`}>{money(a.balance)}</span>
    </button>
  )

  return (
    <header class="topbar">
      <div class="balance">
        <span class="balance-label">Saldo em conta</span>
        <span class={`balance-value ${(selected?.balance ?? 0) < 0 ? 'neg' : ''}`}>
          {money(selected?.balance)}
        </span>
      </div>

      <button class="refresh" onClick={props.onRefresh} disabled={props.refreshing}>
        <span class={props.refreshing ? 'spin' : ''}>↻</span>
        {props.refreshing ? 'Atualizando' : 'Atualizado'}
      </button>

      <button
        class="theme-toggle"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Usar o tema claro (o do Asaas)' : 'Usar o tema escuro'}
        aria-label="Alternar tema"
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      <div class="acct-picker">
        <button class="acct-trigger" onClick={() => setOpen(!open)}>
          <span class="acct-avatar">{initial}</span>
          <span class="acct-name">{selected?.name ?? 'Selecione'}</span>
          <span class="acct-caret">⌄</span>
        </button>

        {open && (
          <>
            <div class="acct-scrim" onClick={() => setOpen(false)} />
            <div class="acct-menu">
              <div class="acct-group">Conta principal</div>
              {master.map(option)}
              {subs.length > 0 && <div class="acct-group">Subcontas</div>}
              {subs.map(option)}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
