/**
 * A ficha da conta selecionada: saldo, walletId, chave de API, accountId, CPF/CNPJ.
 *
 * A CHAVE DE API aparece na tela — e isso é indefensável em qualquer sistema real.
 * Aqui é o ponto: no Asaas, a chave de uma subconta é mostrada UMA vez, na criação, e
 * nunca mais. Quem não guardou, perdeu. Este painel existe num container de localhost
 * atrás de `ADMIN_ENABLED`, e mostrar a chave é o que permite entrar numa subconta e
 * ver o simulador pelos olhos dela.
 *
 * O `walletId` fica ao lado porque é o par: a chave é como você AGE como a conta, o
 * walletId é como você MANDA dinheiro para ela num split.
 */
import type { Account } from '../api.ts'
import { Card, Copy, money, Row } from './ui.tsx'

export function AccountDetail({ account: a }: { account: Account }) {
  return (
    <Card title={a.name} subtitle={a.parentAccountId ? 'Subconta' : 'Conta principal'}>
      <Row label="Saldo">
        <b class={a.balance < 0 ? 'neg' : ''}>{money(a.balance)}</b>
      </Row>
      <Row label="walletId">
        <Copy value={a.walletId} />
      </Row>
      <Row label="Chave de API">
        {a.apiKey ? (
          <Copy value={a.apiKey}>{`${a.apiKey.slice(0, 22)}…`}</Copy>
        ) : (
          <span class="hint">nenhuma</span>
        )}
      </Row>
      <Row label="accountId">
        <Copy value={a.id} />
      </Row>
      <Row label="CPF/CNPJ">
        <span class="mono">{a.cpfCnpj}</span>
      </Row>
      <Row label="E-mail">{a.email}</Row>
    </Card>
  )
}
