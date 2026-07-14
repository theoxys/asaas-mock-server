/**
 * Track H — cartão de crédito.
 *
 * Tokenização, captura de pré-autorização, pagamento de cobrança existente com
 * cartão e a configuração de pré-autorização.
 *
 * A criação de cobrança com cartão (`create-new-payment-with-credit-card`) NÃO
 * está aqui: ela divide a rota `POST /v3/payments` com `create-new-payment`, e
 * quem decide pelo body é o handler canônico, em `../payments/handlers.ts` — que
 * chama `createPaymentWithCard()` deste módulo. É assim que o Asaas real faz.
 */
import { and, eq } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { invalid, notFound } from '../../core/errors.ts'
import { payments, settings } from '../../db/schema/index.ts'
import type { HandlerMap } from '../../http/register.ts'
import { applyTransition } from '../payments/apply.ts'
import { serializePayment, type PaymentRow } from '../payments/serializer.ts'
import { payExistingWithCard, tokenize } from './service.ts'

async function findOwned(ctx: AppContext, auth: AuthContext, id: string): Promise<PaymentRow> {
  const [row] = await ctx.db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.accountId, auth.accountId)))
    .limit(1)
  if (!row) throw notFound('Cobrança')
  return row as PaymentRow
}

/**
 * A configuração de pré-autorização é UMA linha por conta, e não tem tabela
 * própria: mora em `settings`, que existe exatamente para isso. Namespaced por
 * conta — isolamento é invariante, não detalhe.
 */
const PRE_AUTH_KEY = (accountId: string) => `credit_card.pre_authorization:${accountId}`

/**
 * TODO(regra): a doc não publica o default de `daysToExpire` nem o intervalo
 * aceito. Usamos 5 (o exemplo da spec). Uma pré-autorização que EXPIRA sozinha
 * depois de N dias ainda não existe — precisaria de um job no scheduler; hoje
 * uma cobrança AUTHORIZED fica AUTHORIZED até alguém capturar. Está em progress.md.
 */
const DEFAULT_DAYS_TO_EXPIRE = 5

interface PreAuthConfig {
  daysToExpire: number
}

export const creditCardHandlers: HandlerMap = {
  /**
   * `POST /v3/creditCard/tokenizeCreditCard`
   *
   * Devolve os 4 ÚLTIMOS dígitos — não uma máscara com asteriscos, não o número.
   * O PAN completo não é gravado em lugar nenhum (nem em log): `inspectCard`
   * (puro) já o descarta.
   */
  'credit-card-tokenization': async ({ ctx, auth, body }) => {
    const card = await tokenize(ctx, auth, body as Record<string, any>)
    return {
      creditCardNumber: card.last4,
      creditCardBrand: card.brand,
      creditCardToken: card.creditCardToken,
    }
  },

  /**
   * `POST /v3/payments/{id}/captureAuthorizedPayment`
   *
   * Só funciona em AUTHORIZED. Capturar duas vezes → 400 (a segunda encontra a
   * cobrança já CONFIRMED e a máquina de estados recusa). É a máquina que diz
   * não, não um `if` neste handler — por isso não há como divergir.
   */
  'capture-payment-with-pre-authorization': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)
    const r = await applyTransition(ctx, p.id, { kind: 'CAPTURE', on: ctx.clock.today() })
    return serializePayment(ctx.db, r.payment)
  },

  /** `POST /v3/payments/{id}/payWithCreditCard` — pagar cobrança existente. */
  'pay-a-charge-with-credit-card': async ({ ctx, auth, params, body }) =>
    payExistingWithCard(ctx, auth, params.id!, body as Record<string, any>),

  /**
   * `POST /v3/payments/{id}/payWithCard` — a versão nova do endpoint acima.
   * O body é `{ cardType, card, cardToken }` em vez de
   * `{ creditCard, creditCardToken }`; traduzimos e caímos no mesmo caminho.
   */
  'pay-a-charge-with-card': async ({ ctx, auth, params, body }) => {
    const b = (body ?? {}) as Record<string, any>

    if (b.cardType !== undefined && b.cardType !== 'CREDIT') {
      throw invalid(
        'cardType',
        'Apenas cartão de crédito (CREDIT) é aceito. VOUCHER ainda não é simulado.',
      )
    }

    return payExistingWithCard(ctx, auth, params.id!, {
      creditCard: b.card ?? undefined,
      creditCardHolderInfo: b.card?.holder ?? undefined,
      creditCardToken: b.cardToken ?? undefined,
    })
  },

  'retrieve-pre-authorization-configuration': async ({ ctx, auth }) => {
    const [row] = await ctx.db
      .select()
      .from(settings)
      .where(eq(settings.key, PRE_AUTH_KEY(auth.accountId)))
      .limit(1)

    const config = (row?.value as PreAuthConfig | undefined) ?? {
      daysToExpire: DEFAULT_DAYS_TO_EXPIRE,
    }
    return { daysToExpire: config.daysToExpire }
  },

  'save-or-update-pre-authorization-configuration': async ({ ctx, auth, body }) => {
    const b = (body ?? {}) as Record<string, any>
    const days = Number(b.daysToExpire)

    if (!Number.isInteger(days) || days < 1) {
      throw invalid('daysToExpire', 'O prazo de expiração deve ser um número inteiro de dias.')
    }

    const key = PRE_AUTH_KEY(auth.accountId)
    const value: PreAuthConfig = { daysToExpire: days }
    const updatedAt = ctx.clock.timestamp()

    await ctx.db
      .insert(settings)
      .values({ key, value, updatedAt })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt } })

    return { daysToExpire: days }
  },
}

/** Reexportado para quem precisar do mesmo texto de recusa. */
export { DECLINED } from './service.ts'
