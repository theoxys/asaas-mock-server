/**
 * A máquina de estados da cobrança. PURA — não toca banco, relógio nem HTTP.
 *
 * `plan()` recebe o estado atual e um gatilho, e devolve DADOS: o novo status, o
 * patch de campos, e a lista de EFEITOS (webhook a emitir, lançamento no ledger,
 * mudança de status do split). Quem executa é `applyTransition()`, numa
 * transação.
 *
 * POR QUE ASSIM: o webhook e o lançamento financeiro são *efeitos da transição*,
 * não algo que cada handler lembra de fazer. Um `receiveInCash`, um tick do
 * scheduler e uma sandbox action passam todos por aqui — então é impossível que
 * um deles esqueça de emitir o PAYMENT_RECEIVED ou de debitar a taxa. Essa
 * classe de bug simplesmente não existe neste desenho.
 *
 * E porque é pura, a matriz inteira (status × gatilho) é testável sem subir nada.
 */
import type { FeeTable } from '../core/config.ts'
import type { DiscountConfig, FineConfig, InterestConfig } from '../db/schema/payments.ts'
import type { IsoDate } from './calendar.ts'
import { calcFee, calcInstallmentFee, type BillingType } from './fees.ts'
import { calcDiscount, calcOverdueTotals } from './interest.ts'
import { cents, type Cents } from './money.ts'
import { creditDateFor, skipsConfirmed, type SettlementRules } from './settlement.ts'

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'AWAITING_RISK_ANALYSIS'
  | 'CONFIRMED'
  | 'RECEIVED'
  | 'OVERDUE'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'REFUND_IN_PROGRESS'
  | 'REFUNDED'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'

/** O estado da cobrança de que a máquina precisa. */
export interface PaymentState {
  id: string
  status: PaymentStatus
  billingType: BillingType
  valueCents: Cents
  originalValueCents: Cents | null
  netValueCents: Cents
  feeCents: Cents
  dueDate: IsoDate
  confirmedDate: IsoDate | null
  creditDate: IsoDate | null
  discount: DiscountConfig | null
  fine: FineConfig | null
  interest: InterestConfig | null
  installmentCount: number
  /**
   * Qual parcela esta cobrança é (1 = primeira, ou cobrança à vista).
   *
   * Não é enfeite: num parcelamento no cartão as N parcelas confirmam TODAS no
   * mesmo dia, mas creditam escalonadas em D+32×n. Sem este número, todas
   * creditariam juntas — e o extrato do lojista estaria errado por meses.
   */
  installmentNumber: number
  /**
   * O TOTAL do parcelamento, quando esta cobrança é uma parcela.
   *
   * Sem ele, a confirmação RECALCULAVA a taxa com `calcFee` sobre o valor da
   * PARCELA — jogando fora a taxa correta (que sai do total) que a criação já
   * tinha computado. O netValue de uma parcela de cartão saía errado só depois
   * de confirmada, o que é o pior lugar para um erro de dinheiro aparecer.
   */
  installmentTotalCents: Cents | null
  deleted: boolean
}

export type Trigger =
  /** O pagador pagou (Pix/boleto no banco, ou sandbox action de confirmar). */
  | { kind: 'PAY'; on: IsoDate }
  /** Cartão autorizado e capturado. */
  | { kind: 'CONFIRM'; on: IsoDate }
  /** Pré-autorização (authorizeOnly). */
  | { kind: 'AUTHORIZE' }
  /** Captura de uma pré-autorizada. */
  | { kind: 'CAPTURE'; on: IsoDate }
  /** Scheduler: chegou a creditDate. O dinheiro vira saldo. */
  | { kind: 'SETTLE'; on: IsoDate }
  /** Scheduler: passou do vencimento. */
  | { kind: 'OVERDUE'; on: IsoDate }
  /** Baixa manual. NÃO gera saldo nem movimenta o extrato. */
  | { kind: 'RECEIVE_IN_CASH'; on: IsoDate; value: Cents }
  | { kind: 'UNDO_RECEIVE_IN_CASH' }
  | { kind: 'REFUND'; on: IsoDate; value?: Cents }
  | { kind: 'CHARGEBACK' }
  | { kind: 'DELETE' }
  | { kind: 'RESTORE' }

export type LedgerEffectEntry = {
  type: string
  valueCents: Cents
  description: string
}

export type Effect =
  | { t: 'WEBHOOK'; event: string }
  | { t: 'LEDGER'; entries: LedgerEffectEntry[] }
  /** Splits desta cobrança mudam de status (PENDING → AWAITING_CREDIT → DONE…). */
  | { t: 'SPLIT'; to: string; reason?: string }

export interface Plan {
  to: PaymentStatus
  patch: Partial<PaymentState> & Record<string, unknown>
  effects: Effect[]
}

export class TransitionError extends Error {
  constructor(
    readonly code: string,
    readonly description: string,
  ) {
    super(description)
  }
}

export interface MachineDeps {
  fees: FeeTable
  rules: SettlementRules
}

/** Status em que a cobrança já foi paga de alguma forma. */
const PAID: PaymentStatus[] = ['CONFIRMED', 'RECEIVED']
/** Status em que ainda se espera o pagamento. */
const OPEN: PaymentStatus[] = ['PENDING', 'OVERDUE']

/**
 * O plano da transição. Devolve dados; não executa nada.
 * Lança TransitionError quando o gatilho não é válido para o status atual.
 */
export function plan(p: PaymentState, trigger: Trigger, deps: MachineDeps): Plan {
  const reject = (action: string): never => {
    throw new TransitionError(
      'invalid_action',
      `Não é possível executar "${action}" em uma cobrança com status ${p.status}.`,
    )
  }

  switch (trigger.kind) {
    // ─────────────────────────────────────────────────────────
    case 'PAY':
    case 'CONFIRM':
    case 'CAPTURE': {
      if (trigger.kind === 'CAPTURE' && p.status !== 'AUTHORIZED') reject('capturar')
      if (trigger.kind !== 'CAPTURE' && !OPEN.includes(p.status) && p.status !== 'AUTHORIZED') {
        /**
         * Pagar uma cobrança JÁ PAGA tem frase própria no Asaas — capturado
         * (tools/probe-pix.ts). É o erro que um webhook duplicado, um botão clicado
         * duas vezes ou uma retentativa produz, então é o erro que um cliente mais
         * vê. Devolvíamos a frase genérica da máquina de estados.
         */
        if (PAID.includes(p.status)) {
          throw new TransitionError('invalid_action', 'Cobrança já confirmada.')
        }
        reject('confirmar pagamento')
      }

      const on = trigger.on

      /**
       * Quanto se paga de fato:
       *   em atraso → valor + multa + juros
       *   em dia    → valor − desconto (se houver e estiver na janela)
       */
      const overdue = calcOverdueTotals(
        {
          originalValueCents: p.originalValueCents ?? p.valueCents,
          dueDate: p.dueDate,
          fine: p.fine,
          interest: p.interest,
        },
        on,
      )

      const discount =
        overdue.daysLate > 0
          ? cents(0)
          : calcDiscount(p.discount, p.valueCents, p.dueDate, on)

      const paidValue = cents(overdue.value - discount)

      /**
       * A taxa é recalculada sobre o valor efetivamente pago (juros e multa
       * entram na base; desconto sai dela).
       *
       * Numa PARCELA, a base é o total do parcelamento — não a parcela. Ver
       * `calcInstallmentFee`: o Asaas cobra a taxa do cartão uma vez sobre o
       * total e divide entre as N parcelas.
       */
      const fee =
        p.installmentTotalCents !== null && p.installmentCount > 1
          ? calcInstallmentFee(
              deps.fees,
              p.billingType,
              p.installmentTotalCents,
              p.installmentCount,
            )
          : calcFee(deps.fees, p.billingType, paidValue, p.installmentCount)
      const net = cents(paidValue - fee)

      // A parcela `n` de um cartão credita em D+32×n — todas confirmam juntas,
      // mas o dinheiro cai escalonado. Provado contra o sandbox real.
      const creditDate = creditDateFor(p.billingType, on, deps.rules, p.installmentNumber)

      const patch: Plan['patch'] = {
        valueCents: paidValue,
        originalValueCents: overdue.daysLate > 0 ? overdue.originalValue : null,
        feeCents: fee,
        netValueCents: net,
        confirmedDate: on,
        /**
         * `creditDate` é preenchida JÁ NA CONFIRMAÇÃO, apontando para o futuro —
         * não no dia em que o dinheiro cai. Provado contra o sandbox real: um
         * cartão confirmado hoje já devolve `creditDate` daqui a 32 dias.
         *
         * Deixávamos `null` até a liquidação, o que fazia o lojista não conseguir
         * saber QUANDO ia receber — que é justamente a pergunta que o campo
         * responde. Quem distingue "vai cair" de "caiu" é o `status`.
         */
        creditDate,
        estimatedCreditDate: creditDate,
        /**
         * `clientPaymentDate` e `paymentDate` NÃO são a mesma data, e nós as
         * tratávamos como se fossem:
         *
         *   clientPaymentDate → quando o CLIENTE pagou
         *   paymentDate       → quando o dinheiro entrou na conta do LOJISTA
         *
         * Um cartão CONFIRMED tem `clientPaymentDate` preenchida e `paymentDate`
         * **null** — o cliente já pagou, mas o lojista ainda não recebeu.
         * Preenchíamos as duas na confirmação. Provado contra o sandbox real.
         */
        clientPaymentDate: on,
        interestValueCents: overdue.interestValue > 0 ? overdue.interestValue : null,
      }

      /**
       * AQUI está a divergência entre meios de pagamento, e ela vive num lugar só.
       *
       * O Pix não passa por CONFIRMED — cai direto em RECEIVED, com o dinheiro já
       * no saldo. Boleto e cartão passam por CONFIRMED e só creditam depois
       * (D+1 útil / D+32).
       */
      if (skipsConfirmed(p.billingType)) {
        return {
          to: 'RECEIVED',
          // Recebido AGORA: o dinheiro entrou, então `paymentDate` existe.
          patch: { ...patch, creditDate, paymentDate: on },
          effects: [
            { t: 'WEBHOOK', event: 'PAYMENT_RECEIVED' },
            {
              t: 'LEDGER',
              entries: [
                {
                  type: 'PAYMENT_RECEIVED',
                  valueCents: paidValue,
                  description: `Cobrança recebida — ${p.id}`,
                },
                {
                  type: 'PAYMENT_FEE',
                  valueCents: cents(-fee),
                  description: `Taxa de cobrança — ${p.id}`,
                },
              ],
            },
            { t: 'SPLIT', to: 'AWAITING_CREDIT' },
          ],
        }
      }

      return {
        to: 'CONFIRMED',
        patch,
        effects: [
          { t: 'WEBHOOK', event: 'PAYMENT_CONFIRMED' },
          { t: 'SPLIT', to: 'AWAITING_CREDIT' },
        ],
      }
    }

    // ─────────────────────────────────────────────────────────
    case 'SETTLE': {
      // Só o scheduler dispara isto, quando creditDate chega.
      if (p.status !== 'CONFIRMED') reject('liquidar')

      return {
        to: 'RECEIVED',
        patch: {
          creditDate: trigger.on,
          /**
           * O dinheiro entrou AGORA — é aqui que `paymentDate` nasce, e não na
           * confirmação. Enquanto a cobrança estava CONFIRMED ela tinha
           * `clientPaymentDate` (o cliente pagou) mas `paymentDate: null` (o
           * lojista não recebeu). Ver o comentário no gatilho PAY/CONFIRM.
           */
          paymentDate: p.confirmedDate ?? trigger.on,
        },
        effects: [
          { t: 'WEBHOOK', event: 'PAYMENT_RECEIVED' },
          {
            t: 'LEDGER',
            entries: [
              {
                type: 'PAYMENT_RECEIVED',
                valueCents: p.valueCents,
                description: `Cobrança recebida — ${p.id}`,
              },
              {
                type: 'PAYMENT_FEE',
                valueCents: cents(-p.feeCents),
                description: `Taxa de cobrança — ${p.id}`,
              },
            ],
          },
        ],
      }
    }

    // ─────────────────────────────────────────────────────────
    case 'AUTHORIZE': {
      if (!OPEN.includes(p.status)) reject('autorizar')
      return {
        to: 'AUTHORIZED',
        patch: {},
        effects: [{ t: 'WEBHOOK', event: 'PAYMENT_AUTHORIZED' }],
      }
    }

    // ─────────────────────────────────────────────────────────
    case 'OVERDUE': {
      if (p.status !== 'PENDING') reject('vencer')
      return {
        to: 'OVERDUE',
        patch: {},
        effects: [{ t: 'WEBHOOK', event: 'PAYMENT_OVERDUE' }],
      }
    }

    // ─────────────────────────────────────────────────────────
    case 'RECEIVE_IN_CASH': {
      if (!OPEN.includes(p.status)) reject('receber em dinheiro')

      /**
       * Baixa manual: o Asaas NÃO credita saldo nem gera movimentação
       * financeira — o dinheiro foi para o bolso do lojista, fora da plataforma.
       * Por isso não há efeito de LEDGER aqui. É fácil errar isso.
       */
      return {
        to: 'RECEIVED_IN_CASH',
        patch: {
          valueCents: trigger.value,
          paymentDate: trigger.on,
          clientPaymentDate: trigger.on,
        },
        effects: [{ t: 'SPLIT', to: 'CANCELLED', reason: 'PAYMENT_RECEIVED_IN_CASH' }],
      }
    }

    case 'UNDO_RECEIVE_IN_CASH': {
      if (p.status !== 'RECEIVED_IN_CASH') reject('desfazer recebimento em dinheiro')
      return {
        to: 'PENDING',
        patch: { paymentDate: null, clientPaymentDate: null },
        effects: [{ t: 'WEBHOOK', event: 'PAYMENT_RECEIVED_IN_CASH_UNDONE' }],
      }
    }

    // ─────────────────────────────────────────────────────────
    case 'REFUND': {
      if (!PAID.includes(p.status)) reject('estornar')

      const value = trigger.value ?? p.valueCents
      const partial = value < p.valueCents

      /**
       * AS TAXAS NÃO SÃO DEVOLVIDAS. O Asaas retém a tarifa de compensação e a
       * de notificação mesmo num estorno total — por isso o débito é o valor
       * bruto, e a conta fica no negativo pela taxa se o saldo era só aquele.
       */
      const entries: LedgerEffectEntry[] =
        p.status === 'RECEIVED'
          ? [
              {
                type: 'PAYMENT_REVERSAL',
                valueCents: cents(-value),
                description: `Estorno de cobrança — ${p.id}`,
              },
            ]
          : [] // ainda não creditou: não há o que estornar do saldo

      if (partial) {
        return {
          to: p.status, // continua RECEIVED/CONFIRMED
          patch: {},
          effects: [
            { t: 'WEBHOOK', event: 'PAYMENT_PARTIALLY_REFUNDED' },
            ...(entries.length ? [{ t: 'LEDGER' as const, entries }] : []),
          ],
        }
      }

      return {
        to: 'REFUNDED',
        patch: {},
        effects: [
          { t: 'WEBHOOK', event: 'PAYMENT_REFUNDED' },
          ...(entries.length ? [{ t: 'LEDGER' as const, entries }] : []),
          { t: 'SPLIT', to: 'REFUNDED', reason: 'PAYMENT_REFUNDED' },
        ],
      }
    }

    // ─────────────────────────────────────────────────────────
    case 'CHARGEBACK': {
      if (!PAID.includes(p.status)) reject('abrir chargeback')

      /**
       * O valor é DEBITADO do saldo assim que o chargeback chega — o dinheiro
       * volta para o portador antes de qualquer disputa. Mas só há o que debitar
       * se a cobrança já tinha creditado (RECEIVED); uma CONFIRMED ainda não
       * virou saldo. É a mesma assimetria do REFUND, e pelo mesmo motivo.
       *
       * A TAXA NÃO É DEVOLVIDA (igual ao estorno): o débito é o valor bruto.
       */
      const entries: LedgerEffectEntry[] =
        p.status === 'RECEIVED'
          ? [
              {
                type: 'CHARGEBACK',
                valueCents: cents(-p.valueCents),
                description: `Chargeback — ${p.id}`,
              },
            ]
          : []

      return {
        to: 'CHARGEBACK_REQUESTED',
        patch: {},
        effects: [
          { t: 'WEBHOOK', event: 'PAYMENT_CHARGEBACK_REQUESTED' },
          ...(entries.length ? [{ t: 'LEDGER' as const, entries }] : []),
        ],
      }
    }

    // ─────────────────────────────────────────────────────────
    case 'DELETE': {
      // Só dá para remover cobrança que ainda não foi paga.
      if (!OPEN.includes(p.status)) reject('remover')
      return {
        to: p.status,
        patch: { deleted: true },
        effects: [
          { t: 'WEBHOOK', event: 'PAYMENT_DELETED' },
          { t: 'SPLIT', to: 'CANCELLED', reason: 'PAYMENT_DELETED' },
        ],
      }
    }

    case 'RESTORE': {
      if (!p.deleted) {
        throw new TransitionError('invalid_action', 'A cobrança não está removida.')
      }
      return {
        to: p.status,
        patch: { deleted: false },
        effects: [{ t: 'WEBHOOK', event: 'PAYMENT_RESTORED' }],
      }
    }
  }
}
