/**
 * Mapa de handlers: operationId → função.
 *
 * Todo operationId da spec que NÃO estiver aqui é montado automaticamente como
 * `notImplemented` pelo registro dirigido pelo manifesto. Portanto:
 *
 *   - a rota SEMPRE existe (auth, validação e formato de erro incluídos);
 *   - a cobertura é computada daqui, nunca mantida à mão;
 *   - um track novo se integra adicionando uma linha, sem tocar em roteamento.
 *
 * Cada track adiciona seu spread abaixo. Como cada um mora na sua própria pasta,
 * dois agentes trabalhando em paralelo não conflitam.
 */
import type { HandlerMap } from '../http/register.ts'
import { accountDocumentHandlers } from './account-documents/handlers.ts'
import { accountInfoHandlers } from './account-info/handlers.ts'
import { anticipationHandlers } from './anticipations/handlers.ts'
import { chargebackHandlers } from './chargebacks/handlers.ts'
import { checkoutHandlers } from './checkout/handlers.ts'
import { creditBureauHandlers } from './credit-bureau/handlers.ts'
import { creditCardHandlers } from './credit-cards/handlers.ts'
import { customerHandlers } from './customers/handlers.ts'
import { financeHandlers } from './finance/handlers.ts'
import { installmentHandlers } from './installments/handlers.ts'
import { notificationHandlers } from './notifications/handlers.ts'
import { paymentLinkHandlers } from './payment-links/handlers.ts'
import { paymentHandlers, sandboxHandlers } from './payments/handlers.ts'
import { splitHandlers } from './splits/handlers.ts'
import { subaccountHandlers } from './subaccounts/handlers.ts'
import { subscriptionHandlers } from './subscriptions/handlers.ts'
import { transferHandlers } from './transfers/handlers.ts'
import { webhookHandlers } from './webhooks/handlers.ts'

export const HANDLERS: HandlerMap = {
  // Track A — customers, payments, máquina de estados, sandbox actions
  ...customerHandlers,
  ...paymentHandlers,
  ...sandboxHandlers,

  // Track B — webhooks
  ...webhookHandlers,

  // Track G1 — conta, links de pagamento, notificações, checkout, Serasa
  ...accountInfoHandlers,
  // KYC/onboarding da conta + a ação de sandbox que a aprova
  ...accountDocumentHandlers,
  ...paymentLinkHandlers,
  ...notificationHandlers,
  ...checkoutHandlers,
  ...creditBureauHandlers,

  // Track F — split multiconta e subcontas
  ...splitHandlers,
  ...subaccountHandlers,

  // Track D — extrato, saldo, transferências, antecipações
  ...financeHandlers,
  ...transferHandlers,
  ...anticipationHandlers,

  // Track H — cartão: tokenização, pré-autorização/captura, chargeback
  ...creditCardHandlers,
  ...chargebackHandlers,

  // Track E — parcelamentos e assinaturas
  ...installmentHandlers,
  ...subscriptionHandlers,
}
