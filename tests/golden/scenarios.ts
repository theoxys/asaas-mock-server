/**
 * OS ROTEIROS DE PARIDADE.
 *
 * Cada roteiro é uma sequência de chamadas que roda em DOIS lugares:
 *
 *   1. contra o sandbox REAL do Asaas  (bun run capture)  → grava o golden
 *   2. contra este simulador           (bun test parity)  → compara com o golden
 *
 * É o que separa "achamos que a regra é essa" de "provamos que é". Toda regra de
 * negócio deste projeto foi lida na documentação — e a documentação do Asaas se
 * contradiz em pelo menos dois pontos que já encontramos. Um mock sutilmente
 * errado é pior que nenhum mock, porque produz falsa confiança.
 *
 * Para adicionar cobertura, acrescente um roteiro aqui e rode a captura.
 */
import type { OperationId } from '../../src/generated/operations.ts'

export interface Step {
  /** Rótulo legível — aparece no diff quando a paridade quebra. */
  label: string
  operationId: OperationId
  body?: unknown
  params?: Record<string, string>
  query?: Record<string, string | number>
  /**
   * Guarda um valor da resposta para usar nos passos seguintes.
   * Ex.: { customerId: 'id' } grava `response.id` como `$customerId`.
   */
  capture?: Record<string, string>
  /**
   * Campos da resposta a IGNORAR na comparação: os que são legitimamente
   * diferentes entre ambientes (ids, URLs, datas absolutas).
   */
  ignore?: string[]
}

export interface Scenario {
  name: string
  description: string
  steps: Step[]
}

/**
 * Campos que NUNCA batem entre o Asaas real e o simulador, e nem deveriam:
 * identificadores gerados, URLs do domínio deles, datas de criação absolutas.
 *
 * Tudo o que NÃO está nesta lista é comparado — inclusive `value`, `netValue`,
 * `status`, `billingType`, `discount`, `fine`, `interest` e a estrutura inteira
 * do objeto. É aí que uma divergência de regra aparece.
 */
/**
 * `anticipable` fica FORA da comparação, e a razão é honesta:
 *
 * A regra está provada e implementada (`src/domain/anticipable.ts`, com os 11
 * pontos de dados reais em `tests/unit/anticipable.test.ts`):
 *
 *   anticipable = meio antecipável E valor ≤ limite disponível E vencimento ≤ D+90
 *
 * Mas o LIMITE sai da análise de crédito do Asaas e é específico da conta — a
 * conta de sandbox usada na captura tinha um limite de boleto de **R$ 66,66**.
 * Nenhum simulador pode adivinhar esse número, e compará-lo seria comparar o
 * apetite de risco do Asaas, não o nosso código.
 *
 * Se você quiser paridade também aqui, configure o limite da SUA conta
 * (`GET /v3/anticipations/limits`) e tire este campo da lista.
 */
const ACCOUNT_SPECIFIC = ['anticipable']

export const VOLATILE_FIELDS = [
  ...ACCOUNT_SPECIFIC,
  'id',
  'dateCreated',
  'customer',
  'subscription',
  'installment',
  'paymentLink',
  'checkoutSession',
  'invoiceUrl',
  'bankSlipUrl',
  'transactionReceiptUrl',
  'invoiceNumber',
  'nossoNumero',
  'walletId',
  'creditCardToken',
  'pixQrCodeId',
  'pixTransaction',
  'encodedImage',
  'payload',
  'identificationField',
  'barCode',
  'apiKey',
  'accountNumber',
  // Datas absolutas: o sandbox real usa a data de hoje; o simulador usa o
  // relógio virtual. O que comparamos são as datas RELATIVAS (ver
  // `deriveRelativeDates` em parity.test.ts).
  'dueDate',
  'originalDueDate',
  'paymentDate',
  'clientPaymentDate',
  'confirmedDate',
  'creditDate',
  'estimatedCreditDate',
  'effectiveDate',
  'requestDate',
  'date',
]

/**
 * Datas relativas: em vez de comparar '2026-02-06' com '2025-08-14', comparamos
 * a DISTÂNCIA de cada data até uma âncora (a data de criação). É assim que se
 * prova que o cartão credita em D+32 sem depender de quando o teste rodou.
 */
export const RELATIVE_DATE_FIELDS = [
  'dueDate',
  'confirmedDate',
  'creditDate',
  'estimatedCreditDate',
  'paymentDate',
]

const CUSTOMER = {
  name: 'Cliente Paridade',
  cpfCnpj: '24971563792',
  email: 'paridade@example.com',
  // O Asaas real RECUSA celular com todos os dígitos iguais (47999999999 →
  // invalid_mobilePhone), pela mesma lógica que recusa CPF 11111111111. Provado
  // contra o sandbox; nosso simulador ainda aceita — ver progress.md.
  mobilePhone: '47996321478',
}

/**
 * `$hoje`, `$hoje+N` são resolvidos na hora de executar — assim o roteiro roda
 * tanto contra o sandbox real (data de hoje) quanto contra o simulador (relógio
 * virtual congelado).
 */
export const SCENARIOS: Scenario[] = [
  {
    name: 'pix-recebido',
    description:
      'Pix: PENDING → RECEIVED direto (pula CONFIRMED), taxa FIXA de R$ 1,99, ' +
      'netValue = 98,01. É a regra mais fácil de errar (achar que a taxa do Pix é %).',
    steps: [
      {
        label: 'cria cliente',
        operationId: 'create-new-customer',
        body: CUSTOMER,
        capture: { customerId: 'id' },
      },
      {
        label: 'cria cobrança Pix de R$ 100',
        operationId: 'create-new-payment',
        body: {
          customer: '$customerId',
          billingType: 'PIX',
          value: 100,
          dueDate: '$hoje+5',
          description: 'Paridade Pix',
        },
        capture: { paymentId: 'id' },
      },
      {
        label: 'recupera a cobrança',
        operationId: 'retrieve-a-single-payment',
        params: { id: '$paymentId' },
      },
    ],
  },

  {
    name: 'boleto-com-juros-e-multa',
    description:
      'Boleto com multa de 2% e juros de 1% a.m. Prova a composição do netValue ' +
      'e o formato dos objetos discount/fine/interest na resposta.',
    steps: [
      {
        label: 'cria cliente',
        operationId: 'create-new-customer',
        body: CUSTOMER,
        capture: { customerId: 'id' },
      },
      {
        label: 'cria boleto de R$ 350 com multa, juros e desconto',
        operationId: 'create-new-payment',
        body: {
          customer: '$customerId',
          billingType: 'BOLETO',
          value: 350,
          dueDate: '$hoje+10',
          fine: { value: 2, type: 'PERCENTAGE' },
          interest: { value: 1 },
          discount: { value: 5, dueDateLimitDays: 0, type: 'PERCENTAGE' },
        },
        capture: { paymentId: 'id' },
      },
      {
        label: 'recupera a cobrança',
        operationId: 'retrieve-a-single-payment',
        params: { id: '$paymentId' },
      },
    ],
  },

  {
    name: 'cartao-a-vista',
    description:
      'Cartão à vista: taxa R$ 0,49 + 2,99%, e estimatedCreditDate em D+32 ' +
      '(a doc técnica diz 32; o marketing diz 30 — este roteiro decide a briga).',
    steps: [
      {
        label: 'cria cliente',
        operationId: 'create-new-customer',
        body: CUSTOMER,
        capture: { customerId: 'id' },
      },
      {
        label: 'cria cobrança de cartão de R$ 100',
        operationId: 'create-new-payment',
        body: {
          customer: '$customerId',
          billingType: 'CREDIT_CARD',
          value: 100,
          dueDate: '$hoje+5',
        },
        capture: { paymentId: 'id' },
      },
      {
        label: 'recupera a cobrança',
        operationId: 'retrieve-a-single-payment',
        params: { id: '$paymentId' },
      },
    ],
  },

  {
    name: 'parcelamento-350-em-12x',
    description:
      'A regra do resto: R$ 350 em 12x → 11 × R$ 29,16 + R$ 29,24 na ÚLTIMA. ' +
      'Este é o roteiro que prova (ou derruba) a linha 1 do nosso golden test.',
    steps: [
      {
        label: 'cria cliente',
        operationId: 'create-new-customer',
        body: CUSTOMER,
        capture: { customerId: 'id' },
      },
      {
        label: 'cria parcelamento de R$ 350 em 12x',
        operationId: 'create-installment',
        body: {
          customer: '$customerId',
          billingType: 'BOLETO',
          installmentCount: 12,
          totalValue: 350,
          dueDate: '$hoje+10',
        },
        capture: { installmentId: 'id' },
      },
      {
        label: 'lista as 12 parcelas — os valores têm que bater um a um',
        operationId: 'list-payments',
        query: { installment: '$installmentId', limit: 100 },
      },
    ],
  },

  {
    name: 'parcelamento-no-cartao',
    description:
      'Parcelamento no cartão: a emissora autoriza o total de uma vez. As parcelas ' +
      'já nascem CONFIRMED? E o crédito é D+32 a partir da confirmação (todas juntas) ' +
      'ou D+32 do vencimento de cada uma (escalonado)? A doc não diz; este roteiro diz.',
    steps: [
      {
        label: 'cria cliente',
        operationId: 'create-new-customer',
        body: CUSTOMER,
        capture: { customerId: 'id' },
      },
      {
        label: 'parcela R$ 300 em 3x no cartão de teste que aprova',
        operationId: 'create-installment',
        body: {
          customer: '$customerId',
          billingType: 'CREDIT_CARD',
          installmentCount: 3,
          totalValue: 300,
          dueDate: '$hoje+10',
          creditCard: {
            holderName: 'Cliente Paridade',
            number: '4444444444444444',
            expiryMonth: '12',
            expiryYear: '2030',
            ccv: '123',
          },
          creditCardHolderInfo: {
            name: 'Cliente Paridade',
            email: 'paridade@example.com',
            cpfCnpj: '24971563792',
            postalCode: '01310-100',
            addressNumber: '100',
            phone: '47999999999',
          },
          remoteIp: '127.0.0.1',
        },
        capture: { installmentId: 'id' },
      },
      {
        label: 'as 3 parcelas — status e creditDate de cada uma',
        operationId: 'list-payments',
        query: { installment: '$installmentId', limit: 100 },
      },
    ],
  },

  {
    name: 'assinatura-mensal',
    description:
      'A regra mais contraintuitiva: criar a assinatura NÃO cria cobrança. ' +
      'Ela só nasce quando faltam 40 dias para o vencimento. Se a listagem vier ' +
      'vazia no sandbox real, nossa leitura da doc está certa.',
    steps: [
      {
        label: 'cria cliente',
        operationId: 'create-new-customer',
        body: CUSTOMER,
        capture: { customerId: 'id' },
      },
      {
        label: 'cria assinatura mensal com vencimento em 60 dias',
        operationId: 'create-new-subscription',
        body: {
          customer: '$customerId',
          billingType: 'BOLETO',
          value: 100,
          nextDueDate: '$hoje+60',
          cycle: 'MONTHLY',
        },
        capture: { subscriptionId: 'id' },
      },
      {
        label: 'as cobranças da assinatura — esperamos ZERO (faltam 60 dias > 40)',
        operationId: 'list-payments-of-a-subscription',
        params: { id: '$subscriptionId' },
      },
    ],
  },

  {
    name: 'erros-de-validacao',
    description:
      'O formato do erro é contrato: {"errors":[{"code":"invalid_<campo>",...}]}. ' +
      'E o código HTTP da criação: 200, nunca 201.',
    steps: [
      {
        label: 'cliente com CPF inválido → invalid_cpfCnpj',
        operationId: 'create-new-customer',
        body: { name: 'Inválido', cpfCnpj: '11111111111' },
      },
      {
        label: 'cobrança sem campos obrigatórios → 400',
        operationId: 'create-new-payment',
        body: {},
      },
    ],
  },
]
