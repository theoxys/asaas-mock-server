/**
 * Os primitivos. Toda tela é montada com estes — nenhuma inventa cor, raio ou
 * padding próprio.
 *
 * É o mesmo contrato que o resto do projeto tem com o domínio: existe um lugar só
 * onde a regra mora. Uma tela que escreve `background: #0038e5` na unha é uma tela
 * que vai divergir do tema escuro na semana que vem, e ninguém vai notar até um
 * screenshot ficar ilegível.
 */
import type { ComponentChildren, JSX } from 'preact'
import { useState } from 'preact/hooks'
import './ui.css'

// ── moeda e formatação ──────────────────────────────────────────────────────

/** Reais, sempre no locale pt-BR. Nunca `toFixed(2)` com "R$" concatenado. */
export const money = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** "1 cliente" / "3 clientes" — o plural certo é detalhe que a tela nota. */
export const plural = (n: number, um: string, muitos: string) =>
  `${n} ${n === 1 ? um : muitos}`

// ── Card ────────────────────────────────────────────────────────────────────

export function Card(props: {
  title?: ComponentChildren
  actions?: ComponentChildren
  subtitle?: ComponentChildren
  children: ComponentChildren
  /** Sem padding no corpo — para cards que contêm uma tabela de ponta a ponta. */
  flush?: boolean
  class?: string
}) {
  return (
    <section class={`card ${props.class ?? ''}`}>
      {(props.title || props.subtitle || props.actions) && (
        <header class="card-hdr">
          <div>
            {props.title && <h2>{props.title}</h2>}
            {props.subtitle && <p class="card-sub">{props.subtitle}</p>}
          </div>
          {props.actions && <div class="card-actions">{props.actions}</div>}
        </header>
      )}
      <div class={props.flush ? 'card-body flush' : 'card-body'}>{props.children}</div>
    </section>
  )
}

// ── Button ──────────────────────────────────────────────────────────────────

/**
 * `IntrinsicElements['button']`, não `HTMLAttributes<HTMLButtonElement>`: no Preact é
 * ali que vivem os atributos próprios do elemento (`disabled`, `type`, `form`). O
 * genérico só traz os globais, e um `<Button disabled>` não compilaria.
 */
type ButtonProps = JSX.IntrinsicElements['button'] & {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'outline', size = 'md', ...rest }: ButtonProps) {
  return <button {...rest} class={`btn ${variant} ${size} ${rest.class ?? ''}`} />
}

// ── Badge ───────────────────────────────────────────────────────────────────

export type Tone = 'neutral' | 'primary' | 'success' | 'warn' | 'danger'

export function Badge(props: { tone?: Tone; solid?: boolean; children: ComponentChildren }) {
  const tone = props.tone ?? 'neutral'
  return <span class={`badge ${tone} ${props.solid ? 'solid' : ''}`}>{props.children}</span>
}

/**
 * O status de uma cobrança sempre com a MESMA cor, em qualquer tela.
 *
 * Se a lista pintasse OVERDUE de vermelho e o card de laranja, o dev perderia
 * tempo procurando a diferença que não existe.
 */
export const STATUS_TONE: Record<string, Tone> = {
  RECEIVED: 'success',
  RECEIVED_IN_CASH: 'success',
  DUNNING_RECEIVED: 'success',
  CONFIRMED: 'primary',
  AWAITING_CREDIT: 'primary',
  PENDING: 'warn',
  AUTHORIZED: 'warn',
  AWAITING_RISK_ANALYSIS: 'warn',
  OVERDUE: 'danger',
  DUNNING_REQUESTED: 'danger',
  REFUNDED: 'neutral',
  CHARGEBACK: 'danger',
  CHARGEBACK_REQUESTED: 'danger',
  CHARGEBACK_DISPUTE: 'danger',
  AWAITING_CHARGEBACK_REVERSAL: 'danger',
}

export const StatusBadge = ({ status }: { status: string }) => (
  <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
)

// ── Copy ────────────────────────────────────────────────────────────────────

/** Um valor que existe para ser colado no código do usuário. */
export function Copy({ value, children }: { value: string; children?: ComponentChildren }) {
  const [copied, setCopied] = useState(false)

  return (
    <span class="copy">
      <span class="mono">{children ?? value}</span>
      <button
        class="copy-btn"
        onClick={() => {
          navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
      >
        {copied ? 'copiado' : 'copiar'}
      </button>
    </span>
  )
}

// ── Banner ──────────────────────────────────────────────────────────────────

export function Banner(props: {
  tone?: 'warn' | 'danger' | 'primary'
  icon?: string
  children: ComponentChildren
  action?: ComponentChildren
}) {
  return (
    <div class={`banner ${props.tone ?? 'warn'}`}>
      <span class="banner-icon">{props.icon ?? '⚠'}</span>
      <div class="banner-text">{props.children}</div>
      {props.action}
    </div>
  )
}

// ── Table ───────────────────────────────────────────────────────────────────

/**
 * Tabela larga rola DENTRO do card. Sem isto, a página inteira ganha barra
 * horizontal e o layout quebra na primeira coluna com um id de 32 caracteres.
 */
export const Table = ({ children }: { children: ComponentChildren }) => (
  <div class="scroll">
    <table>{children}</table>
  </div>
)

export const Empty = ({ children }: { children: ComponentChildren }) => (
  <div class="empty">{children}</div>
)

// ── KeyValue ────────────────────────────────────────────────────────────────

export const Row = ({ label, children }: { label: string; children: ComponentChildren }) => (
  <div class="kv-row">
    <span class="kv-label">{label}</span>
    <span class="kv-value">{children}</span>
  </div>
)
