import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { AppContext, AuthContext } from '../../core/context.ts'
import { badRequest, invalid, notFound } from '../../core/errors.ts'
import { listEnvelope, paginationParams } from '../../core/pagination.ts'
import { accounts, payments, paymentRefunds } from '../../db/schema/index.ts'
import { addMonths } from '../../domain/calendar.ts'
import type { BillingType } from '../../domain/fees.ts'
import { calcOverdueTotals } from '../../domain/interest.ts'
import * as ids from '../../domain/ids.ts'
import { brlToCents, cents, centsToBrl } from '../../domain/money.ts'
import { brCodePayload } from '../../domain/pix-brcode.ts'
import { qrPng } from '../../domain/qrcode.ts'
import { simulate, type SimulatedBilling } from '../../domain/simulator.ts'
import type { HandlerMap } from '../../http/register.ts'
import { createPaymentWithCard, hasCreditCard } from '../credit-cards/service.ts'
import { createInstallmentFlow, installmentInputFromPaymentBody } from '../installments/service.ts'
import { applyTransition } from './apply.ts'
import { serializePayment, type PaymentRow } from './serializer.ts'
import { createPayment, parseCreateBody } from './service.ts'

async function findOwned(ctx: AppContext, auth: AuthContext, id: string): Promise<PaymentRow> {
  const [row] = await ctx.db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.accountId, auth.accountId)))
    .limit(1)
  if (!row) throw notFound('Cobrança')
  return row as PaymentRow
}

export const paymentHandlers: HandlerMap = {
  /**
   * Atende TAMBÉM `create-new-payment-with-credit-card` — na spec do Asaas as
   * duas operações dividem POST /v3/payments, e o BODY decide qual é qual.
   *
   * Com cartão (`creditCard` ou `creditCardToken`), a cobrança não nasce
   * PENDING: a captura acontece no ato da criação e ela já vai para CONFIRMED
   * (ou AUTHORIZED, se `authorizeOnly`). Se a operadora recusa, a cobrança nem
   * chega a existir — 400. Todo esse caminho vive no track H.
   */
  'create-new-payment': async ({ ctx, auth, body }) => {
    const b = body as Record<string, any>

    /**
     * Parcelamento pela porta de POST /v3/payments — o Asaas aceita, e é o que o
     * cliente típico usa (informar `installmentCount` numa cobrança comum, sem
     * conhecer /v3/installments).
     *
     * O que ele devolve é a PRIMEIRA PARCELA — um objeto `payment` com
     * `installment` preenchido, `installmentNumber: 1` e a descrição gerada
     * ("Parcela 1 de 3.") — e NÃO o objeto do parcelamento. Provado contra o
     * sandbox real. O motor é o mesmo de /v3/installments; muda só a resposta.
     */
    if (Number(b.installmentCount ?? 1) > 1) {
      const { payments: parts } = await createInstallmentFlow(
        ctx,
        auth,
        b,
        installmentInputFromPaymentBody(b),
      )
      return serializePayment(ctx.db, parts[0]!)
    }

    if (hasCreditCard(b)) return createPaymentWithCard(ctx, auth, b)

    const row = await ctx.db.transaction(async (tx) =>
      createPayment(ctx, tx as never, auth.accountId, auth.walletId, parseCreateBody(b)),
    )

    return serializePayment(ctx.db, row)
  },

  'list-payments': async ({ ctx, auth, query }) => {
    const { limit, offset } = paginationParams(query)

    const filters = [eq(payments.accountId, auth.accountId), eq(payments.deleted, false)]
    if (query.customer) filters.push(eq(payments.customerId, String(query.customer)))
    if (query.billingType) filters.push(eq(payments.billingType, String(query.billingType)))
    if (query.status) filters.push(eq(payments.status, String(query.status)))
    if (query.subscription) {
      filters.push(eq(payments.subscriptionId, String(query.subscription)))
    }
    if (query.installment) filters.push(eq(payments.installmentId, String(query.installment)))
    if (query.externalReference) {
      filters.push(eq(payments.externalReference, String(query.externalReference)))
    }
    if (query.paymentDate) filters.push(eq(payments.paymentDate, String(query.paymentDate)))
    if (query['dueDate[ge]']) filters.push(gte(payments.dueDate, String(query['dueDate[ge]'])))
    if (query['dueDate[le]']) filters.push(lte(payments.dueDate, String(query['dueDate[le]'])))
    if (query['dateCreated[ge]']) {
      filters.push(gte(payments.dateCreated, String(query['dateCreated[ge]'])))
    }
    if (query['dateCreated[le]']) {
      filters.push(lte(payments.dateCreated, String(query['dateCreated[le]'])))
    }

    const where = and(...filters)

    const [total] = await ctx.db.select({ n: count() }).from(payments).where(where)

    /**
     * DA MAIS NOVA PARA A MAIS ANTIGA. Provado contra o sandbox real: listar as
     * parcelas de um parcelamento de 12x devolve a #12 primeiro.
     *
     * Ordenamos por `rowid` (a ordem física de inserção), não por `dateCreated`:
     * as 12 parcelas nascem no MESMO dia — e, sob o relógio virtual congelado, no
     * mesmo milissegundo. Qualquer ordenação por tempo empataria as 12 e a ordem
     * ficaria por conta do SQLite, ou seja, indefinida.
     */
    const rows = await ctx.db
      .select()
      .from(payments)
      .where(where)
      .orderBy(desc(sql`rowid`))
      .limit(limit)
      .offset(offset)

    const data = await Promise.all(rows.map((r) => serializePayment(ctx.db, r as PaymentRow)))
    return listEnvelope(data, total?.n ?? 0, limit, offset)
  },

  /**
   * `POST /v3/payments/simulate` — quanto sobra se eu cobrar X por cada meio.
   * Não cria nada, não toca no banco.
   *
   * Cada meio expõe um conjunto DIFERENTE de campos, e não é por acaso — é o que
   * o sandbox real devolve:
   *
   *   creditCard → feePercentage + operationFee   (sem feeValue)
   *   bankSlip   → feeValue                       (sem feePercentage)
   *   pix        → feeValue + feePercentage: null (o campo existe, sempre nulo)
   */
  'sales-simulator': async ({ ctx, body }) => {
    const b = body as Record<string, any>

    if (b.value === undefined || b.value === null || Number(b.value) <= 0) {
      throw invalid('value', 'O valor da simulação deve ser maior que zero.')
    }
    if (!Array.isArray(b.billingTypes) || b.billingTypes.length === 0) {
      throw invalid('billingTypes', 'Informe ao menos um meio de pagamento.')
    }

    const sim = simulate(ctx.config.fees, {
      valueCents: brlToCents(Number(b.value)),
      billingTypes: b.billingTypes as BillingType[],
      installmentCount: b.installmentCount ?? null,
    })

    const parcels = (i: SimulatedBilling['installment']) =>
      i && {
        paymentNetValue: centsToBrl(i.paymentNetValueCents),
        paymentValue: centsToBrl(i.paymentValueCents),
      }

    return {
      value: centsToBrl(sim.valueCents),
      creditCard: sim.creditCard && {
        netValue: centsToBrl(sim.creditCard.netValueCents),
        feePercentage: sim.creditCard.feeBp! / 100,
        operationFee: centsToBrl(sim.creditCard.feeFixedCents),
        installment: parcels(sim.creditCard.installment),
      },
      bankSlip: sim.bankSlip && {
        netValue: centsToBrl(sim.bankSlip.netValueCents),
        feeValue: centsToBrl(sim.bankSlip.feeFixedCents),
        installment: parcels(sim.bankSlip.installment),
      },
      pix: sim.pix && {
        netValue: centsToBrl(sim.pix.netValueCents),
        feePercentage: null,
        feeValue: centsToBrl(sim.pix.feeFixedCents),
        installment: parcels(sim.pix.installment),
      },
    }
  },

  /**
   * `GET /v3/payments/{id}/pixQrCode` — o "copia e cola" e a imagem do QR.
   *
   * Sem isto, uma compra por Pix não tem como ser paga: é a única coisa que o
   * comprador de fato usa. O `payload` é um BR Code EMV de verdade, com CRC16 —
   * aponte a câmera e o celular lê.
   *
   * BOLETO também responde: o Asaas emite boleto híbrido, com Pix embutido.
   * Restringir a PIX seria mais estrito que a API real.
   *
   * `expirationDate` = dueDate + 1 ANO, às 23:59:59. Não é a data de vencimento
   * da cobrança, e não é o prazo do Pix — é um ano depois. Provado em dois
   * pontos contra o sandbox (2026-12-31 → 2027-12-31; 2026-08-20 → 2027-08-20).
   */
  'get-qr-code-for-pix-payments': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)

    const [account] = await ctx.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, auth.accountId))
      .limit(1)

    const payload = brCodePayload({
      url: `pix.localhost/qr/cobv/${p.id.replace('pay_', '')}`,
      merchantName: account?.name ?? 'ASAAS',
      merchantCity: account?.city ?? 'SAO PAULO',
      postalCode: account?.postalCode ?? undefined,
    })

    return {
      success: true,
      encodedImage: qrPng(payload),
      payload,
      expirationDate: `${addMonths(p.dueDate, 12)} 23:59:59`,
      // Sem acento, e é assim mesmo que o Asaas escreve.
      description: p.description ?? 'Descricao nao informada',
    }
  },

  'retrieve-a-single-payment': async ({ ctx, auth, params }) =>
    serializePayment(ctx.db, await findOwned(ctx, auth, params.id!)),

  'retrieve-status-of-a-payment': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)
    return { status: p.status }
  },

  'update-existing-payment': async ({ ctx, auth, params, body }) => {
    const p = await findOwned(ctx, auth, params.id!)
    const b = body as Record<string, any>

    // Só dá para editar cobrança que ainda não foi paga.
    if (p.status !== 'PENDING' && p.status !== 'OVERDUE') {
      throw badRequest(
        'invalid_action',
        'Só é possível alterar cobranças aguardando pagamento ou vencidas.',
      )
    }

    const patch: Record<string, unknown> = {}
    if (b.value !== undefined) {
      const value = brlToCents(Number(b.value))
      if (value <= 0) throw invalid('value', 'O valor da cobrança deve ser maior que zero.')
      const { calcFee, netValue } = await import('../../domain/fees.ts')
      const fee = calcFee(ctx.config.fees, p.billingType as never, value)
      patch.valueCents = value
      patch.feeCents = fee
      patch.netValueCents = netValue(value, fee)
    }
    if (b.dueDate !== undefined) patch.dueDate = String(b.dueDate)
    if (b.description !== undefined) patch.description = b.description
    if (b.externalReference !== undefined) patch.externalReference = b.externalReference
    if (b.billingType !== undefined) patch.billingType = b.billingType
    if (b.discount !== undefined) patch.discount = b.discount
    if (b.fine !== undefined) patch.fine = b.fine
    if (b.interest !== undefined) patch.interest = b.interest

    /**
     * `customer` NÃO existe no schema de update da spec — o Asaas não permite
     * trocar o cliente de uma cobrança, e o campo é simplesmente descartado.
     * Não há o que validar aqui: o Elysia já o removeu do body.
     */

    await ctx.db.transaction(async (tx) => {
      await tx.update(payments).set(patch).where(eq(payments.id, p.id))
      const [after] = await tx.select().from(payments).where(eq(payments.id, p.id)).limit(1)

      await ctx.emit(tx as never, {
        accountId: auth.accountId,
        event: 'PAYMENT_UPDATED',
        resourceType: 'payment',
        resourceId: p.id,
        resource: await serializePayment(tx as never, after as PaymentRow),
      })
    })

    return serializePayment(ctx.db, await findOwned(ctx, auth, p.id))
  },

  'delete-payment': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)
    await applyTransition(ctx, p.id, { kind: 'DELETE' })
    return { deleted: true, id: p.id }
  },

  'restore-removed-payment': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)
    const r = await applyTransition(ctx, p.id, { kind: 'RESTORE' })
    return serializePayment(ctx.db, r.payment)
  },

  /**
   * Baixa manual. NÃO gera saldo nem lançamento — o dinheiro entrou fora da
   * plataforma. É fácil errar isso e creditar a conta.
   */
  'confirm-cash-receipt': async ({ ctx, auth, params, body }) => {
    const p = await findOwned(ctx, auth, params.id!)
    const b = body as Record<string, any>

    const on = b.paymentDate ? String(b.paymentDate) : ctx.clock.today()
    const value = b.value !== undefined ? brlToCents(Number(b.value)) : cents(p.valueCents)

    const r = await applyTransition(ctx, p.id, { kind: 'RECEIVE_IN_CASH', on, value })
    return serializePayment(ctx.db, r.payment)
  },

  'undo-cash-receipt-confirmation': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)
    const r = await applyTransition(ctx, p.id, { kind: 'UNDO_RECEIVE_IN_CASH' })
    return serializePayment(ctx.db, r.payment)
  },

  'refund-payment': async ({ ctx, auth, params, body }) => {
    const p = await findOwned(ctx, auth, params.id!)
    const b = (body ?? {}) as Record<string, any>

    const value = b.value !== undefined ? brlToCents(Number(b.value)) : cents(p.valueCents)
    if (value > p.valueCents) {
      throw invalid('value', 'O valor do estorno não pode ser maior que o valor da cobrança.')
    }

    const r = await applyTransition(ctx, p.id, {
      kind: 'REFUND',
      on: ctx.clock.today(),
      value,
    })

    await ctx.db.insert(paymentRefunds).values({
      id: ids.genericId(ctx.rng),
      paymentId: p.id,
      status: 'DONE',
      valueCents: value,
      description: b.description ?? null,
      // As taxas NÃO são devolvidas — o Asaas retém.
      refundedFeeCents: 0,
      effectiveDate: ctx.clock.today(),
      transactionReceiptUrl: null,
      dateCreated: ctx.clock.timestamp(),
    })

    return serializePayment(ctx.db, r.payment)
  },

  'get-digitable-bill-line': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)
    if (p.billingType !== 'BOLETO' && p.billingType !== 'UNDEFINED') {
      throw badRequest(
        'invalid_action',
        'A linha digitável só existe para cobranças com boleto.',
      )
    }
    // Linha digitável fictícia, com o formato certo (47 dígitos em 5 blocos).
    const d = ctx.rng.digits(47)
    return {
      identificationField: `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33, 47)}`,
      nossoNumero: p.nossoNumero,
      barCode: ctx.rng.digits(44),
    }
  },

  'payment-viewing-information': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)
    return {
      invoiceViewedDate: p.lastInvoiceViewedDate,
      boletoViewedDate: p.lastBankSlipViewedDate,
    }
  },

  /**
   * Quanto se paga por esta cobrança HOJE — com juros e multa se estiver
   * vencida, com desconto se estiver na janela.
   */
  'retrieve-payment-billing-information': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)
    const totals = calcOverdueTotals(
      {
        originalValueCents: cents(p.originalValueCents ?? p.valueCents),
        dueDate: p.dueDate,
        fine: p.fine,
        interest: p.interest,
      },
      ctx.clock.today(),
    )

    return {
      creditCard: null,
      pix: null,
      bankSlip:
        p.billingType === 'BOLETO' || p.billingType === 'UNDEFINED'
          ? {
              identificationField: null,
              nossoNumero: p.nossoNumero,
              barCode: null,
              bankSlipUrl: p.bankSlipUrl,
              daysAfterDueDateToRegistrationCancellation:
                p.daysAfterDueDateToRegistrationCancellation,
            }
          : null,
      value: centsToBrl(cents(totals.value)),
    }
  },
}

/**
 * Ações que só existem no sandbox — e que são a razão de este simulador ser
 * usável: sem elas você não teria como "pagar" uma cobrança.
 */
export const sandboxHandlers: HandlerMap = {
  'confirm-payment': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)
    // PAY passa pela máquina de estados: Pix vai direto a RECEIVED (com saldo e
    // taxa no extrato); boleto e cartão param em CONFIRMED e creditam depois.
    const r = await applyTransition(ctx, p.id, { kind: 'PAY', on: ctx.clock.today() })
    return serializePayment(ctx.db, r.payment)
  },

  'force-expire': async ({ ctx, auth, params }) => {
    const p = await findOwned(ctx, auth, params.id!)
    const r = await applyTransition(ctx, p.id, { kind: 'OVERDUE', on: ctx.clock.today() })
    return serializePayment(ctx.db, r.payment)
  },
}
