/**
 * O shell. Sidebar + topbar + a página, e — o mais importante — as duas faixas de
 * aviso que aparecem em QUALQUER tela.
 *
 * Elas estão aqui, e não dentro das telas do Simulador, porque os dois bugs que mais
 * custaram tempo neste projeto eram invisíveis exatamente por isso: o relógio ficou
 * 105 dias no futuro e toda cobrança nova nascia OVERDUE; a fila de webhooks travou
 * atrás de uma entrega envenenada e o pedido do usuário ficou eternamente pendente.
 * Em nenhum dos dois casos o sintoma parecia ter a ver com a causa — e nada na tela
 * ligava uma coisa à outra.
 */
import { useEffect, useState } from 'preact/hooks'
import { admin } from './api.ts'
import * as I from './icons.ts'
import { Icon } from './components/Icon.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Topbar } from './components/Topbar.tsx'
import { Banner, Button, plural } from './components/ui.tsx'
import { Customers } from './pages/Customers.tsx'
import { Home } from './pages/Home.tsx'
import { Payments } from './pages/Payments.tsx'
import { SimulateSale } from './pages/SimulateSale.tsx'
import { Splits } from './pages/Splits.tsx'
import { Statement } from './pages/Statement.tsx'
import { Subaccounts } from './pages/Subaccounts.tsx'
import { Clock } from './pages/sim/Clock.tsx'
import { TestCards } from './pages/sim/TestCards.tsx'
import { Webhooks } from './pages/sim/Webhooks.tsx'
import { useStore, type Store } from './store.ts'
import './app.css'

/** O que toda página recebe. `navigate` porque um card leva à lista que ele resume. */
export interface PageProps {
  store: Store
  navigate: (page: string) => void
}

const TITLES: Record<string, string> = {
  home: 'Início',
  customers: 'Meus Clientes',
  payments: 'Cobranças',
  statement: 'Extrato da Conta',
  splits: 'Split de pagamentos',
  subaccounts: 'Subcontas',
  'sim-clock': 'Relógio virtual',
  'sim-webhooks': 'Fila de webhooks',
  'sim-cards': 'Cartões de teste',
}

/**
 * A página fica no hash. Trinta linhas a menos que um router, e resolve o que
 * importa: recarregar não te joga de volta na home, o botão de voltar do browser
 * funciona, e você consegue mandar `#sim-webhooks` para alguém que está com a fila
 * travada em vez de descrever onde clicar.
 */
function useHashPage(fallback: string) {
  const read = () => window.location.hash.slice(1) || fallback
  const [page, setPage] = useState(read)

  useEffect(() => {
    const onHash = () => setPage(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return [page, (p: string) => (window.location.hash = p)] as const
}

export function App() {
  const store = useStore()
  const [page, setPage] = useHashPage('home')
  const [saleOpen, setSaleOpen] = useState(false)

  const drift = store.clock?.driftDays ?? 0
  const blocked = store.queues.filter((q) => q.blocked)

  const resetClock = async () => {
    const r = await admin('/clock/reset', { method: 'POST' })
    await store.reload()
    if (r.rescheduledDeliveries > 0) {
      alert(
        `Relógio de volta ao presente.\n\n` +
          `${plural(r.rescheduledDeliveries, 'entrega de webhook estava agendada', 'entregas de webhook estavam agendadas')} ` +
          `no futuro e ${r.rescheduledDeliveries === 1 ? 'voltou' : 'voltaram'} para a fila.`,
      )
    }
  }

  const props = { store, navigate: setPage }

  return (
    <div class="shell">
      <Sidebar
        page={page}
        onNavigate={setPage}
        onSimulateSale={() => setSaleOpen(true)}
        webhookAlerts={blocked.length}
      />

      <main>
        <Topbar
          accounts={store.accounts}
          selected={store.selected}
          onSelect={store.select}
          onRefresh={() => void store.reload()}
          refreshing={store.loading}
        />

        <div class="content">
          <div class="crumbs">
            <Icon icon={I.HOME} size={15} />
            <span class="crumb-current">{TITLES[page] ?? page}</span>
          </div>

          <h1>
            {page === 'home' ? `Olá, ${store.selected?.name ?? '…'}` : (TITLES[page] ?? page)}
          </h1>

          {store.error && <Banner tone="danger">{store.error}</Banner>}

          {/* O relógio é GLOBAL ao container: um `+32` clicado aqui move o tempo
              para a aplicação que integra do outro lado também. */}
          {drift > 0 && (
            <Banner
              icon={I.CLOCK}
              action={
                <Button variant="primary" size="sm" onClick={() => void resetClock()}>
                  Voltar ao presente
                </Button>
              }
            >
              O simulador está <b>{plural(drift, 'dia', 'dias')} no futuro</b> (
              {store.clock?.today}). Toda cobrança nova nasce <b>OVERDUE</b>, porque o
              vencimento de hoje já passou para ele.
            </Banner>
          )}

          {blocked.length > 0 && page !== 'sim-webhooks' && (
            <Banner
              tone="danger"
              icon={I.WEBHOOK}
              action={
                <Button variant="danger" size="sm" onClick={() => setPage('sim-webhooks')}>
                  Ver fila
                </Button>
              }
            >
              {plural(blocked.length, 'fila de webhook está travada', 'filas de webhook estão travadas')}.
              Enquanto isso, <b>nenhum evento chega</b> na sua aplicação — e o pagamento
              parece pago aqui e pendente lá.
            </Banner>
          )}

          <Page page={page} {...props} />
        </div>
      </main>

      {saleOpen && <SimulateSale store={store} onClose={() => setSaleOpen(false)} />}
    </div>
  )
}

function Page({ page, ...p }: PageProps & { page: string }) {
  switch (page) {
    case 'home':
      return <Home {...p} />
    case 'customers':
      return <Customers {...p} />
    case 'payments':
      return <Payments {...p} />
    case 'statement':
      return <Statement {...p} />
    case 'splits':
      return <Splits {...p} />
    case 'subaccounts':
      return <Subaccounts {...p} />
    case 'sim-clock':
      return <Clock {...p} />
    case 'sim-webhooks':
      return <Webhooks {...p} />
    case 'sim-cards':
      return <TestCards /> // a tabela vem do domínio, não da conta selecionada
    default:
      return null
  }
}
