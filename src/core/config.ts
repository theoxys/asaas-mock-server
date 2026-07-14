/**
 * Configuração vinda do ambiente.
 *
 * Toda regra de negócio numérica do Asaas (taxas, prazos, lookahead) é
 * CONFIGURÁVEL de propósito. As regras foram pesquisadas na documentação, não
 * provadas contra a API real — então, quando descobrirmos uma divergência, a
 * correção tem que ser mudança de configuração, não de código.
 */
import { bp, cents, type BasisPoints, type Cents } from '../domain/money.ts'
import type { ClockMode } from './clock.ts'

const num = (key: string, fallback: number): number => {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error(`Env ${key} não é um número: "${raw}"`)
  return n
}

const str = (key: string, fallback: string): string => process.env[key] || fallback
const optionalStr = (key: string): string | undefined => process.env[key] || undefined
const bool = (key: string, fallback: boolean): boolean => {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return fallback
  return raw === 'true' || raw === '1'
}

/**
 * Tabela de taxas do Asaas (tabela pública de preços).
 * Cobradas só quando a cobrança é PAGA — emitir não custa nada.
 */
export interface FeeTable {
  /** Boleto liquidado. */
  boleto: Cents
  /** Pix recebido: valor FIXO, não percentual. */
  pix: Cents
  creditCard: {
    fixed: Cents
    /** A faixa depende do número de parcelas. */
    oneInstallment: BasisPoints
    upToSix: BasisPoints
    upToTwelve: BasisPoints
    upToTwentyOne: BasisPoints
  }
  debitCard: { fixed: Cents; pct: BasisPoints }
  transfer: {
    ted: Cents
    pix: Cents
    /** Transferências gratuitas por mês. */
    monthlyWithoutFee: number
  }

  /**
   * As taxas abaixo NÃO são cobradas na liquidação de uma cobrança — são taxas
   * de serviço, cobradas quando o serviço é usado. Existem aqui porque
   * GET /v3/myAccount/fees devolve a tabela inteira, e porque a consulta ao
   * Serasa (creditBureauReport) precisa de um preço.
   */
  /** Consulta Serasa. O preço difere por tipo de pessoa. */
  creditBureauReport: { naturalPerson: Cents; legalPerson: Cents }
  /** Notificações ao cliente final. */
  notification: { phoneCall: Cents; whatsApp: Cents; messaging: Cents }
  /** Nota fiscal de serviço emitida. */
  invoice: Cents
  /** Negativação no Serasa. */
  paymentDunning: Cents
  /** Antecipação: taxa AO MÊS, em basis points. */
  anticipation: {
    creditCardDetached: BasisPoints
    creditCardInstallment: BasisPoints
    bankSlip: BasisPoints
  }
}

export interface Config {
  port: number
  databasePath: string
  seed: number | undefined
  adminEnabled: boolean
  logLevel: string

  /**
   * Base das URLs públicas que a API DEVOLVE (link de pagamento, checkout,
   * download de imagem/relatório). Não é a URL onde este servidor escuta: é o
   * host que o Asaas colocaria na resposta, e integrações costumam exibi-lo.
   */
  publicBaseUrl: string

  clock: { mode: ClockMode; start: string | undefined; tickIntervalMs: number }

  seedAccount: {
    apiKey: string | undefined
    name: string
    cpfCnpj: string
    email: string
    balanceCents: Cents
  }

  webhook: {
    /**
     * Dentro do container, "localhost" é o PRÓPRIO container — o webhook nunca
     * chegaria na máquina do dev. Reescrevemos o host. É a pegadinha nº 1 deste
     * projeto e a razão de ele existir.
     */
    localhostRewrite: string | undefined
    timeoutMs: number
    maxAttempts: number
    retentionDays: number
    maxPerAccount: number
  }

  rules: {
    /** O Asaas gera a cobrança da assinatura 40 dias antes do vencimento. */
    subscriptionLookaheadDays: number
    /** Cartão de crédito credita em D+32. */
    creditCardSettlementDays: number
    /** Cartão de débito credita em D+3. */
    debitCardSettlementDays: number
    /** Boleto credita em D+1 útil. */
    bankSlipSettlementDays: number
    /** Prazo para ajustar um split bloqueado por divergência de valor. */
    splitDivergenceGraceBusinessDays: number
    /** TODO(regra): a doc não define o default de `minutesToExpire` do checkout. */
    checkoutMinutesToExpire: number
  }

  fees: FeeTable
}

export function loadConfig(): Config {
  const seedRaw = process.env.SEED
  return {
    port: num('PORT', 45445),
    databasePath: str('DATABASE_PATH', './data/asaas.db'),
    seed: seedRaw === undefined || seedRaw === '' ? undefined : Number(seedRaw),
    adminEnabled: bool('ADMIN_ENABLED', true),
    logLevel: str('LOG_LEVEL', 'info'),
    publicBaseUrl: str('PUBLIC_BASE_URL', 'https://sandbox.asaas.com'),

    clock: {
      mode: str('CLOCK_MODE', 'REAL') as ClockMode,
      start: optionalStr('CLOCK_START'),
      tickIntervalMs: num('TICK_INTERVAL_MS', 60_000),
    },

    seedAccount: {
      apiKey: optionalStr('ASAAS_API_KEY'),
      name: str('SEED_ACCOUNT_NAME', 'Conta Principal'),
      cpfCnpj: str('SEED_ACCOUNT_CPF_CNPJ', '47960950000121'),
      email: str('SEED_ACCOUNT_EMAIL', 'conta@localhost'),
      balanceCents: cents(num('SEED_ACCOUNT_BALANCE_CENTS', 0)),
    },

    webhook: {
      localhostRewrite: optionalStr('WEBHOOK_LOCALHOST_REWRITE'),
      timeoutMs: num('WEBHOOK_TIMEOUT_MS', 10_000),
      maxAttempts: num('WEBHOOK_MAX_ATTEMPTS', 15),
      retentionDays: num('WEBHOOK_RETENTION_DAYS', 14),
      maxPerAccount: num('WEBHOOK_MAX_PER_ACCOUNT', 10),
    },

    rules: {
      subscriptionLookaheadDays: num('SUBSCRIPTION_LOOKAHEAD_DAYS', 40),
      creditCardSettlementDays: num('CREDIT_CARD_SETTLEMENT_DAYS', 32),
      debitCardSettlementDays: num('DEBIT_CARD_SETTLEMENT_DAYS', 3),
      bankSlipSettlementDays: num('BANK_SLIP_SETTLEMENT_DAYS', 1),
      splitDivergenceGraceBusinessDays: num('SPLIT_DIVERGENCE_GRACE_BUSINESS_DAYS', 2),
      checkoutMinutesToExpire: num('CHECKOUT_MINUTES_TO_EXPIRE', 60),
    },

    fees: {
      boleto: cents(num('FEE_BOLETO_CENTS', 199)),
      pix: cents(num('FEE_PIX_CENTS', 199)),
      creditCard: {
        fixed: cents(num('FEE_CC_FIXED_CENTS', 49)),
        oneInstallment: bp(num('FEE_CC_PCT_BP_1X', 299)),
        upToSix: bp(num('FEE_CC_PCT_BP_2_6', 349)),
        upToTwelve: bp(num('FEE_CC_PCT_BP_7_12', 399)),
        upToTwentyOne: bp(num('FEE_CC_PCT_BP_13_21', 429)),
      },
      debitCard: {
        fixed: cents(num('FEE_DEBIT_FIXED_CENTS', 35)),
        pct: bp(num('FEE_DEBIT_PCT_BP', 189)),
      },
      transfer: {
        ted: cents(num('FEE_TED_CENTS', 500)),
        pix: cents(num('FEE_PIX_TRANSFER_CENTS', 0)),
        monthlyWithoutFee: num('FEE_TRANSFER_MONTHLY_WITHOUT_FEE', 30),
      },

      creditBureauReport: {
        naturalPerson: cents(num('FEE_CREDIT_BUREAU_NATURAL_CENTS', 1699)),
        legalPerson: cents(num('FEE_CREDIT_BUREAU_LEGAL_CENTS', 1699)),
      },
      notification: {
        phoneCall: cents(num('FEE_NOTIFICATION_PHONE_CALL_CENTS', 55)),
        whatsApp: cents(num('FEE_NOTIFICATION_WHATSAPP_CENTS', 55)),
        messaging: cents(num('FEE_NOTIFICATION_MESSAGING_CENTS', 99)),
      },
      invoice: cents(num('FEE_INVOICE_CENTS', 99)),
      paymentDunning: cents(num('FEE_PAYMENT_DUNNING_CENTS', 990)),
      anticipation: {
        creditCardDetached: bp(num('FEE_ANTICIPATION_CC_DETACHED_BP', 249)),
        creditCardInstallment: bp(num('FEE_ANTICIPATION_CC_INSTALLMENT_BP', 200)),
        bankSlip: bp(num('FEE_ANTICIPATION_BANK_SLIP_BP', 499)),
      },
    },
  }
}
