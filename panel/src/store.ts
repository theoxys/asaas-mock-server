/**
 * O estado que TODA tela precisa: as contas, qual está selecionada, o relógio e a
 * saúde das filas de webhook.
 *
 * Um hook, não um framework de estado. São quatro campos e um `reload()` — trazer
 * um store aqui seria cerimônia sem ganho, e o painel inteiro cabe na cabeça.
 *
 * O relógio e as filas ficam AQUI, e não dentro das telas do Simulador, por um
 * motivo: os avisos que eles produzem ("você está 105 dias no futuro", "a fila está
 * travada") precisam aparecer em QUALQUER tela. Os dois bugs que mais custaram
 * tempo neste projeto eram invisíveis justamente porque só se manifestavam em outro
 * lugar do sistema.
 */
import { useCallback, useEffect, useState } from 'preact/hooks'
import { admin, type Account, type Clock, type QueueHealth } from './api.ts'

export interface Store {
  accounts: Account[]
  selected: Account | null
  clock: Clock | null
  queues: QueueHealth[]
  loading: boolean
  error: string | null
  select(id: string): void
  reload(): Promise<void>
}

export function useStore(): Store {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clock, setClock] = useState<Clock | null>(null)
  const [queues, setQueues] = useState<QueueHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [a, c, q] = await Promise.all([
        admin('/accounts'),
        admin('/clock'),
        admin('/webhooks/queue'),
      ])
      setAccounts(a.accounts)
      setClock(c)
      setQueues(q.webhooks)
      setError(null)

      // Na primeira carga entra na conta principal — é onde a chave do usuário está
      // e onde a maioria das cobranças nasce.
      setSelectedId((cur) => {
        if (cur && a.accounts.some((x: Account) => x.id === cur)) return cur
        return a.accounts.find((x: Account) => !x.parentAccountId)?.id ?? a.accounts[0]?.id ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    accounts,
    selected: accounts.find((a) => a.id === selectedId) ?? null,
    clock,
    queues,
    loading,
    error,
    select: setSelectedId,
    reload,
  }
}
