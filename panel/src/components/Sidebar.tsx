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
import * as I from '../icons.ts'
import { Icon, type IconData } from './Icon.tsx'
import { MockLogo } from './MockLogo.tsx'
import './Sidebar.css'

export interface NavItem {
  id: string
  label: string
  icon: IconData
  /** Sem tela ainda. Fica visível e apagado — some seria pior. */
  disabled?: boolean
}

/** As telas do Asaas. A ordem é a do painel real. */
export const ASAAS_NAV: NavItem[] = [
  { id: 'home', label: 'Início', icon: I.HOME },
  { id: 'customers', label: 'Meus Clientes', icon: I.CUSTOMER },
  { id: 'payments', label: 'Cobranças', icon: I.PAYMENT },
  { id: 'physical', label: 'Vendas físicas', icon: I.STORE, disabled: true },
  { id: 'pix', label: 'Pix', icon: I.PIX, disabled: true },
  { id: 'statement', label: 'Extrato da Conta', icon: I.STATEMENT },
  { id: 'anticipations', label: 'Antecipações', icon: I.ANTICIPATION, disabled: true },
  { id: 'dunning', label: 'Negativação', icon: I.ALERT, disabled: true },
  { id: 'splits', label: 'Split de pagamentos', icon: I.SPLIT },
  { id: 'subaccounts', label: 'Subcontas', icon: I.SUBACCOUNT },
  /**
   * Webhook é configuração DA CONTA, e existe no painel do Asaas de verdade — por isso
   * mora aqui em cima, e não no bloco do Simulador. Cada conta tem os seus, e um evento
   * da conta X só é entregue aos webhooks de X.
   *
   * (O DIAGNÓSTICO da fila — por que ela travou, quantas entregas estão presas atrás —
   * esse sim é introspecção nossa. A tela diz isso.)
   */
  { id: 'webhooks', label: 'Webhooks', icon: I.WEBHOOK },
]

/** O que NÃO existe no Asaas. É por isso que fica num bloco à parte. */
export const SIM_NAV: NavItem[] = [
  { id: 'sim-clock', label: 'Relógio virtual', icon: I.CLOCK },
  { id: 'sim-cards', label: 'Cartões de teste', icon: I.CARD },
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
      <Icon icon={i.icon} size={20} class="nav-icon" />
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

      <nav>{ASAAS_NAV.map((i) => item(i, i.id === 'webhooks' ? props.webhookAlerts : 0))}</nav>

      <div class="sim-section">
        <div class="sim-label">
          Simulador
          <Icon
            icon={I.HELP}
            size={13}
            class="sim-hint"
            title="Nada aqui existe na API do Asaas. São controles do mock."
          />
        </div>
        <nav>{SIM_NAV.map((i) => item(i))}</nav>
      </div>
    </aside>
  )
}
