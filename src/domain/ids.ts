/**
 * Geração de identificadores no formato exato do Asaas.
 *
 * Os prefixos NÃO são uniformes — parte dos recursos usa prefixo, parte usa UUID
 * puro. Isto foi verificado na documentação, um por um. Não "padronize": um
 * cliente que valida `id.startsWith('pay_')` tem que continuar funcionando, e um
 * que espera UUID puro em `installment` também.
 */
import type { Rng } from '../core/rng.ts'

// ── com prefixo ──────────────────────────────────────────────
export const paymentId = (rng: Rng) => `pay_${rng.digits(12)}`
export const customerId = (rng: Rng) => `cus_${rng.digits(12)}`
export const subscriptionId = (rng: Rng) => `sub_${rng.alphanumeric(12)}`
/** `not_wuGp97JeCr7G` — a notificação de um cliente. */
export const notificationId = (rng: Rng) => `not_${rng.alphanumeric(12)}`

/** `evt_<hex32>&<n>`. O sufixo `&<n>` faz parte do id — está em todos os exemplos oficiais. */
export const webhookEventId = (rng: Rng, seq: number) => `evt_${rng.hex(32)}&${seq}`

// ── UUID puro, sem prefixo ───────────────────────────────────
export const installmentId = (rng: Rng) => rng.uuid()
export const transferId = (rng: Rng) => rng.uuid()
export const anticipationId = (rng: Rng) => rng.uuid()
export const splitId = (rng: Rng) => rng.uuid()
export const webhookConfigId = (rng: Rng) => rng.uuid()
export const walletId = (rng: Rng) => rng.uuid()
export const accountId = (rng: Rng) => rng.uuid()
export const creditCardToken = (rng: Rng) => rng.uuid()
export const checkoutId = (rng: Rng) => rng.uuid()
export const creditBureauReportId = (rng: Rng) => rng.uuid()
export const paymentLinkImageId = (rng: Rng) => rng.uuid()
export const genericId = (rng: Rng) => rng.uuid()

// ── só dígitos, sem prefixo ──────────────────────────────────
/** `725104409743` — o link de pagamento não tem prefixo nem é UUID. */
export const paymentLinkId = (rng: Rng) => rng.digits(12)

/** Chave de API do sandbox. A de produção usa `$aact_prod_`. */
export const apiKey = (rng: Rng) =>
  `$aact_hmlg_${rng.alphanumeric(24)}::${rng.uuid()}::$${rng.alphanumeric(40)}`

/** Número da fatura: 8 dígitos com zeros à esquerda. */
export const invoiceNumber = (rng: Rng) => rng.digits(8)

/** `nossoNumero` do boleto. */
export const nossoNumero = (rng: Rng) => rng.digits(11)
