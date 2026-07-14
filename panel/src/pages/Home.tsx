import { useEffect, useState } from 'preact/hooks'
import { admin, type GroupSummary } from '../api.ts'
import type { PageProps } from '../app.tsx'
import { StatusCard } from '../components/StatusCard.tsx'
import { AccountDetail } from '../components/AccountDetail.tsx'
import { Card, Empty } from '../components/ui.tsx'
import { TestCardList } from './sim/TestCards.tsx'

export function Home({ store, navigate }: PageProps) {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null)
  const accountId = store.selected?.id

  useEffect(() => {
    if (!accountId) return
    setGroups(null)
    void admin(`/summary?accountId=${accountId}`).then((r) => setGroups(r.groups))
  }, [accountId, store.accounts])

  return (
    <>
      <Card title="Situação das cobranças">
        {!groups ? (
          <Empty>carregando…</Empty>
        ) : (
          <div class="stat-grid">
            {groups.map((g) => (
              <StatusCard key={g.group} s={g} onDrill={() => navigate('payments')} />
            ))}
          </div>
        )}
      </Card>

      <div class="split-2">
        <Card
          title="Cartões de crédito de teste"
          subtitle="Use estes cartões para simular transações. Qualquer número bem-formado aprova — estes forçam erros específicos."
        >
          <TestCardList compact />
        </Card>

        {store.selected && <AccountDetail account={store.selected} />}
      </div>
    </>
  )
}
