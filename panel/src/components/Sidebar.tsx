/**
 * A navegação. Duas seções, e a fronteira entre elas é deliberada.
 *
 * Em cima, o que o painel do Asaas tem. Embaixo, sob a marca "Simulador", o que
 * SÓ existe aqui: viagem no tempo, fila de webhooks, cartões de teste. Se os dois
 * blocos se misturassem, alguém acabaria escrevendo código contando com um botão
 * que não existe em produção — e descobriria tarde.
 *
 * Os itens sem tela aparecem DESABILITADOS em vez de sumirem. Ver "Antecipações"
 * apagado responde "isso ainda não tem aqui"; não ver nada faz procurar.
 */
import { MockLogo } from './MockLogo.tsx'
import './Sidebar.css'

export interface NavItem {
  id: string
  label: string
  icon: string
  /** Sem tela ainda. Fica visível e apagado — some seria pior. */
  disabled?: boolean
}

/** As telas do Asaas. A ordem é a do painel real. */
export const ASAAS_NAV: NavItem[] = [
  { id: 'home', label: 'Início', icon: '⌂' },
  { id: 'customers', label: 'Meus Clientes', icon: '☺\uFE0E' },
  { id: 'payments', label: 'Cobranças', icon: '▤' },
  { id: 'physical', label: 'Vendas físicas', icon: '▭', disabled: true },
  { id: 'pix', label: 'Pix', icon: '⌁', disabled: true },
  { id: 'statement', label: 'Extrato da Conta', icon: '≡' },
  { id: 'anticipations', label: 'Antecipações', icon: '↟', disabled: true },
  { id: 'dunning', label: 'Negativação', icon: '⚑\uFE0E', disabled: true },
  { id: 'splits', label: 'Split de pagamentos', icon: '⑃' },
  { id: 'subaccounts', label: 'Subcontas', icon: '⚯' },
]

/** O que NÃO existe no Asaas. É por isso que fica num bloco à parte. */
export const SIM_NAV: NavItem[] = [
  { id: 'sim-clock', label: 'Relógio virtual', icon: '⏱\uFE0E' },
  { id: 'sim-webhooks', label: 'Fila de webhooks', icon: '⇄' },
  { id: 'sim-cards', label: 'Cartões de teste', icon: '▯' },
]

export function Sidebar(props: {
  page: string
  onNavigate: (id: string) => void
  onSimulateSale: () => void
  /** Quantas filas de webhook estão travadas — o badge vermelho da navegação. */
  webhookAlerts: number
}) {
  const item = (i: NavItem, badge?: number) => (
    <button
      key={i.id}
      class={`nav-item ${props.page === i.id ? 'active' : ''}`}
      disabled={i.disabled}
      title={i.disabled ? 'Ainda não implementado no simulador' : undefined}
      onClick={() => props.onNavigate(i.id)}
    >
      <span class="nav-icon">{i.icon}</span>
      <span class="nav-label">{i.label}</span>
      {badge ? <span class="nav-badge">{badge}</span> : null}
    </button>
  )

  return (
    <aside class="sidebar">
      <div class="sidebar-top">
        <MockLogo />
        <button class="btn primary md simulate" onClick={props.onSimulateSale}>
          Simular Venda
        </button>
      </div>

      <nav>{ASAAS_NAV.map((i) => item(i))}</nav>

      <div class="sim-section">
        <div class="sim-label">
          Simulador
          <span class="sim-hint" title="Nada aqui existe na API do Asaas. São controles do mock.">
            ?
          </span>
        </div>
        <nav>
          {SIM_NAV.map((i) => item(i, i.id === 'sim-webhooks' ? props.webhookAlerts : 0))}
        </nav>
      </div>
    </aside>
  )
}
