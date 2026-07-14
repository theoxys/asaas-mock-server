// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'

export const AccountDocumentGroupResponseAccountDocumentStatus = Type.Union([
  Type.Literal("NOT_SENT"),
  Type.Literal("PENDING"),
  Type.Literal("APPROVED"),
  Type.Literal("REJECTED"),
  Type.Literal("IGNORED"),
])
export type AccountDocumentGroupResponseAccountDocumentStatus = (typeof AccountDocumentGroupResponseAccountDocumentStatus)['static']

export const AccountDocumentResponsibleType = Type.Union([
  Type.Literal("ALLOW_BANK_ACCOUNT_DEPOSIT_STATEMENT"),
  Type.Literal("ASAAS_ACCOUNT_OWNER_EMANCIPATION_AGE"),
  Type.Literal("ASAAS_ACCOUNT_OWNER"),
  Type.Literal("ASSOCIATION"),
  Type.Literal("BANK_ACCOUNT_OWNER_EMANCIPATION_AGE"),
  Type.Literal("BANK_ACCOUNT_OWNER"),
  Type.Literal("CUSTOM"),
  Type.Literal("DIRECTOR"),
  Type.Literal("INDIVIDUAL_COMPANY"),
  Type.Literal("LIMITED_COMPANY"),
  Type.Literal("MEI"),
  Type.Literal("PARTNER"),
  Type.Literal("POWER_OF_ATTORNEY"),
])
export type AccountDocumentResponsibleType = (typeof AccountDocumentResponsibleType)['static']

export const AccountDocumentStatus = Type.Union([
  Type.Literal("NOT_SENT"),
  Type.Literal("PENDING"),
  Type.Literal("APPROVED"),
  Type.Literal("REJECTED"),
])
export type AccountDocumentStatus = (typeof AccountDocumentStatus)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const AccountDocumentType = Type.Union([
  Type.Literal("ALLOW_BANK_ACCOUNT_DEPOSIT_STATEMENT"),
  Type.Literal("CUSTOM"),
  Type.Literal("EMANCIPATION_OF_MINORS"),
  Type.Literal("ENTREPRENEUR_REQUIREMENT"),
  Type.Literal("IDENTIFICATION_SELFIE"),
  Type.Literal("IDENTIFICATION"),
  Type.Literal("INVOICE"),
  Type.Literal("MEI_CERTIFICATE"),
  Type.Literal("MINUTES_OF_CONSTITUTION"),
  Type.Literal("MINUTES_OF_ELECTION"),
  Type.Literal("POWER_OF_ATTORNEY"),
  Type.Literal("SOCIAL_CONTRACT"),
])
export type AccountDocumentType = (typeof AccountDocumentType)['static']

export const AccountInfoCityState = Type.Union([
  Type.Literal("AC"),
  Type.Literal("AL"),
  Type.Literal("AP"),
  Type.Literal("AM"),
  Type.Literal("BA"),
  Type.Literal("CE"),
  Type.Literal("DF"),
  Type.Literal("ES"),
  Type.Literal("GO"),
  Type.Literal("MA"),
  Type.Literal("MT"),
  Type.Literal("MS"),
  Type.Literal("MG"),
  Type.Literal("PA"),
  Type.Literal("PB"),
  Type.Literal("PR"),
  Type.Literal("PE"),
  Type.Literal("PI"),
  Type.Literal("RR"),
  Type.Literal("RO"),
  Type.Literal("RJ"),
  Type.Literal("RN"),
  Type.Literal("RS"),
  Type.Literal("SC"),
  Type.Literal("SP"),
  Type.Literal("SE"),
  Type.Literal("TO"),
])
export type AccountInfoCityState = (typeof AccountInfoCityState)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const AnticipationStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("DENIED"),
  Type.Literal("CREDITED"),
  Type.Literal("DEBITED"),
  Type.Literal("CANCELLED"),
  Type.Literal("OVERDUE"),
  Type.Literal("SCHEDULED"),
])
export type AnticipationStatus = (typeof AnticipationStatus)['static']

export const BankAccountType = Type.Union([
  Type.Literal("CONTA_CORRENTE"),
  Type.Literal("CONTA_POUPANCA"),
])
export type BankAccountType = (typeof BankAccountType)['static']

/** Colapsa 12 schemas idênticos da spec. */
export const BillingType = Type.Union([
  Type.Literal("UNDEFINED"),
  Type.Literal("BOLETO"),
  Type.Literal("CREDIT_CARD"),
  Type.Literal("PIX"),
])
export type BillingType = (typeof BillingType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const BillStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("BANK_PROCESSING"),
  Type.Literal("PAID"),
  Type.Literal("FAILED"),
  Type.Literal("CANCELLED"),
  Type.Literal("REFUNDED"),
  Type.Literal("AWAITING_CHECKOUT_RISK_ANALYSIS_REQUEST"),
])
export type BillStatus = (typeof BillStatus)['static']

export const CardTransactionType = Type.Union([
  Type.Literal("CREDIT"),
  Type.Literal("VOUCHER"),
])
export type CardTransactionType = (typeof CardTransactionType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const ChargebackDisputeStatus = Type.Union([
  Type.Literal("REQUESTED"),
  Type.Literal("ACCEPTED"),
  Type.Literal("REJECTED"),
])
export type ChargebackDisputeStatus = (typeof ChargebackDisputeStatus)['static']

export const ChargebackReason = Type.Union([
  Type.Literal("ABSENCE_OF_PRINT"),
  Type.Literal("ABSENT_CARD_FRAUD"),
  Type.Literal("CARD_ACTIVATED_PHONE_TRANSACTION"),
  Type.Literal("CARD_FRAUD"),
  Type.Literal("CARD_RECOVERY_BULLETIN"),
  Type.Literal("COMMERCIAL_DISAGREEMENT"),
  Type.Literal("COPY_NOT_RECEIVED"),
  Type.Literal("CREDIT_OR_DEBIT_PRESENTATION_ERROR"),
  Type.Literal("DIFFERENT_PAY_METHOD"),
  Type.Literal("FRAUD"),
  Type.Literal("INCORRECT_TRANSACTION_VALUE"),
  Type.Literal("INVALID_CURRENCY"),
  Type.Literal("INVALID_DATA"),
  Type.Literal("LATE_PRESENTATION"),
  Type.Literal("LOCAL_REGULATORY_OR_LEGAL_DISPUTE"),
  Type.Literal("MULTIPLE_ROCS"),
  Type.Literal("ORIGINAL_CREDIT_TRANSACTION_NOT_ACCEPTED"),
  Type.Literal("OTHER_ABSENT_CARD_FRAUD"),
  Type.Literal("PROCESS_ERROR"),
  Type.Literal("RECEIVED_COPY_ILLEGIBLE_OR_INCOMPLETE"),
  Type.Literal("RECURRENCE_CANCELED"),
  Type.Literal("REQUIRED_AUTHORIZATION_NOT_GRANTED"),
  Type.Literal("RIGHT_OF_FULL_RECOURSE_FOR_FRAUD"),
  Type.Literal("SALE_CANCELED"),
  Type.Literal("SERVICE_DISAGREEMENT_OR_DEFECTIVE_PRODUCT"),
  Type.Literal("SERVICE_NOT_RECEIVED"),
  Type.Literal("SPLIT_SALE"),
  Type.Literal("TRANSFERS_OF_DIVERSE_RESPONSIBILITIES"),
  Type.Literal("UNQUALIFIED_CAR_RENTAL_DEBIT"),
  Type.Literal("USA_CARDHOLDER_DISPUTE"),
  Type.Literal("VISA_FRAUD_MONITORING_PROGRAM"),
  Type.Literal("WARNING_BULLETIN_FILE"),
])
export type ChargebackReason = (typeof ChargebackReason)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const ChargebackStatus = Type.Union([
  Type.Literal("REQUESTED"),
  Type.Literal("IN_DISPUTE"),
  Type.Literal("DISPUTE_LOST"),
  Type.Literal("REVERSED"),
  Type.Literal("DONE"),
])
export type ChargebackStatus = (typeof ChargebackStatus)['static']

/** Colapsa 5 schemas idênticos da spec. */
export const ChargeType = Type.Union([
  Type.Literal("DETACHED"),
  Type.Literal("RECURRENT"),
  Type.Literal("INSTALLMENT"),
])
export type ChargeType = (typeof ChargeType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const CheckoutSessionResponseBillingType = Type.Union([
  Type.Literal("CREDIT_CARD"),
  Type.Literal("PIX"),
])
export type CheckoutSessionResponseBillingType = (typeof CheckoutSessionResponseBillingType)['static']

export const CheckoutSessionStatus = Type.Union([
  Type.Literal("ACTIVE"),
  Type.Literal("CANCELED"),
  Type.Literal("EXPIRED"),
  Type.Literal("PAID"),
])
export type CheckoutSessionStatus = (typeof CheckoutSessionStatus)['static']

/** Colapsa 5 schemas idênticos da spec. */
export const CompanyType = Type.Union([
  Type.Literal("MEI"),
  Type.Literal("LIMITED"),
  Type.Literal("INDIVIDUAL"),
  Type.Literal("ASSOCIATION"),
])
export type CompanyType = (typeof CompanyType)['static']

/** Colapsa 4 schemas idênticos da spec. */
export const CreditCardBrand = Type.Union([
  Type.Literal("VISA"),
  Type.Literal("MASTERCARD"),
  Type.Literal("ELO"),
  Type.Literal("DINERS"),
  Type.Literal("DISCOVER"),
  Type.Literal("AMEX"),
  Type.Literal("CABAL"),
  Type.Literal("BANESCARD"),
  Type.Literal("CREDZ"),
  Type.Literal("SOROCRED"),
  Type.Literal("CREDSYSTEM"),
  Type.Literal("JCB"),
  Type.Literal("UNKNOWN"),
])
export type CreditCardBrand = (typeof CreditCardBrand)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const CustomerApiAccessTokenDisabledReason = Type.Union([
  Type.Literal("LACK_OF_USE"),
  Type.Literal("MANUAL"),
  Type.Literal("ACCOUNT_OWNER_ARRANGEMENT_TYPE_CHANGED_TO_INDICATION_PARTNER"),
])
export type CustomerApiAccessTokenDisabledReason = (typeof CustomerApiAccessTokenDisabledReason)['static']

/** Colapsa 9 schemas idênticos da spec. */
export const Cycle = Type.Union([
  Type.Literal("WEEKLY"),
  Type.Literal("BIWEEKLY"),
  Type.Literal("MONTHLY"),
  Type.Literal("BIMONTHLY"),
  Type.Literal("QUARTERLY"),
  Type.Literal("SEMIANNUALLY"),
  Type.Literal("YEARLY"),
])
export type Cycle = (typeof Cycle)['static']

export const DataPaymentDunningHistoryStatus = Type.Union([
  Type.Literal("IN_NEGOTIATION"),
  Type.Literal("NEGOTIATION_FAIL"),
  Type.Literal("NEGOTIATED"),
  Type.Literal("PAID"),
])
export type DataPaymentDunningHistoryStatus = (typeof DataPaymentDunningHistoryStatus)['static']

export const EnotasTipoAutenticacao = Type.Union([
  Type.Literal("CERTIFICATE"),
  Type.Literal("TOKEN"),
  Type.Literal("USER_AND_PASSWORD"),
])
export type EnotasTipoAutenticacao = (typeof EnotasTipoAutenticacao)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const FinanceGetPaymentStatisticsRequestBillingType = Type.Union([
  Type.Literal("BOLETO"),
  Type.Literal("CREDIT_CARD"),
  Type.Literal("TRANSFER"),
  Type.Literal("DEPOSIT"),
  Type.Literal("DEBIT_CARD"),
  Type.Literal("PIX"),
])
export type FinanceGetPaymentStatisticsRequestBillingType = (typeof FinanceGetPaymentStatisticsRequestBillingType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const FinanceGetPaymentStatisticsRequestPaymentStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("RECEIVED"),
  Type.Literal("CONFIRMED"),
  Type.Literal("OVERDUE"),
])
export type FinanceGetPaymentStatisticsRequestPaymentStatus = (typeof FinanceGetPaymentStatisticsRequestPaymentStatus)['static']

export const FinancialTransactionType = Type.Union([
  Type.Literal("PAYMENT_RECEIVED"),
  Type.Literal("TRANSFER"),
  Type.Literal("TRANSFER_FEE"),
  Type.Literal("TRANSFER_REVERSAL"),
  Type.Literal("REVERSAL"),
  Type.Literal("PAYMENT_REVERSAL"),
  Type.Literal("PAYMENT_REFUND_CANCELLED"),
  Type.Literal("PAYMENT_FEE"),
  Type.Literal("PAYMENT_FEE_REVERSAL"),
  Type.Literal("PAYMENT_CUSTODY_BLOCK"),
  Type.Literal("PAYMENT_CUSTODY_BLOCK_REVERSAL"),
  Type.Literal("PHONE_CALL_NOTIFICATION_FEE"),
  Type.Literal("PROMOTIONAL_CODE_CREDIT"),
  Type.Literal("DEBIT"),
  Type.Literal("DEBIT_REVERSAL"),
  Type.Literal("DEBT_RECOVERY_NEGOTIATION_FINANCIAL_CHARGES"),
  Type.Literal("RECEIVABLE_ANTICIPATION_GROSS_CREDIT"),
  Type.Literal("RECEIVABLE_ANTICIPATION_FEE"),
  Type.Literal("RECEIVABLE_ANTICIPATION_DEBIT"),
  Type.Literal("BILL_PAYMENT"),
  Type.Literal("BILL_PAYMENT_FEE"),
  Type.Literal("BILL_PAYMENT_CANCELLED"),
  Type.Literal("BILL_PAYMENT_FEE_CANCELLED"),
  Type.Literal("BILL_PAYMENT_REFUNDED"),
  Type.Literal("POSTAL_SERVICE_FEE"),
  Type.Literal("INTERNAL_TRANSFER_DEBIT"),
  Type.Literal("INTERNAL_TRANSFER_CREDIT"),
  Type.Literal("INTERNAL_TRANSFER_REVERSAL"),
  Type.Literal("CREDIT"),
  Type.Literal("PARTIAL_PAYMENT"),
  Type.Literal("PAYMENT_MESSAGING_NOTIFICATION_FEE"),
  Type.Literal("PAYMENT_SMS_NOTIFICATION_FEE"),
  Type.Literal("PAYMENT_DUNNING_REQUEST_FEE"),
  Type.Literal("PAYMENT_DUNNING_RECEIVED_FEE"),
  Type.Literal("PAYMENT_DUNNING_RECEIVED_IN_CASH_FEE"),
  Type.Literal("PAYMENT_DUNNING_CANCELLATION_FEE"),
  Type.Literal("CUSTOMER_COMMISSION_SETTLEMENT_CREDIT"),
  Type.Literal("CUSTOMER_COMMISSION_SETTLEMENT_DEBIT"),
  Type.Literal("CUSTOMER_COMMISSION_IR_WITHHOLDING_CREDIT"),
  Type.Literal("CUSTOMER_COMMISSION_IR_WITHHOLDING_DEBIT"),
  Type.Literal("PROMOTIONAL_CODE_DEBIT"),
  Type.Literal("REFUND_REQUEST_FEE"),
  Type.Literal("REFUND_REQUEST_CANCELLED"),
  Type.Literal("REFUND_REQUEST_FEE_REVERSAL"),
  Type.Literal("INVOICE_FEE"),
  Type.Literal("PRODUCT_INVOICE_FEE"),
  Type.Literal("CONSUMER_INVOICE_FEE"),
  Type.Literal("ASAAS_CARD_RECHARGE"),
  Type.Literal("ASAAS_CARD_RECHARGE_REVERSAL"),
  Type.Literal("ASAAS_CARD_BALANCE_REFUND"),
  Type.Literal("CHARGEBACK"),
  Type.Literal("CHARGEBACK_REVERSAL"),
  Type.Literal("ASAAS_CARD_BILL_PAYMENT"),
  Type.Literal("ASAAS_CARD_SECURED_CREDIT_LIMIT_DEPOSIT"),
  Type.Literal("ASAAS_CARD_SECURED_CREDIT_LIMIT_WITHDRAWAL"),
  Type.Literal("ASAAS_CARD_TRANSACTION"),
  Type.Literal("ASAAS_CARD_CASHBACK"),
  Type.Literal("ASAAS_CARD_CREDIT_TRANSFER"),
  Type.Literal("ASAAS_CARD_CREDIT_TRANSFER_CANCELLATION"),
  Type.Literal("ASAAS_CARD_CREDIT_TRANSFER_PARTIAL_CANCELLATION"),
  Type.Literal("ASAAS_CARD_CREDIT_VOUCHER"),
  Type.Literal("ASAAS_CARD_CREDIT_VOUCHER_REFUND"),
  Type.Literal("ASAAS_CARD_DEBIT_TRANSFER"),
  Type.Literal("ASAAS_CARD_DEBIT_TRANSFER_CANCELLATION"),
  Type.Literal("ASAAS_CARD_DEBIT_TRANSFER_PARTIAL_CANCELLATION"),
  Type.Literal("ASAAS_CARD_TRANSACTION_FEE"),
  Type.Literal("ASAAS_CARD_TRANSACTION_WITHDRAWAL_FEE"),
  Type.Literal("ASAAS_CARD_TRANSACTION_IOF_FEE"),
  Type.Literal("ASAAS_CARD_TRANSACTION_REFUND"),
  Type.Literal("ASAAS_CARD_TRANSACTION_FEE_REFUND"),
  Type.Literal("ASAAS_CARD_TRANSACTION_WITHDRAWAL_FEE_REFUND"),
  Type.Literal("ASAAS_CARD_TRANSACTION_PARTIAL_REFUND"),
  Type.Literal("ASAAS_CARD_TRANSACTION_REFUND_CANCELLATION"),
  Type.Literal("ASAAS_CARD_TRANSACTION_PARTIAL_REFUND_CANCELLATION"),
  Type.Literal("ASAAS_MONEY_PAYMENT_COMPROMISED_BALANCE_REFUND"),
  Type.Literal("ASAAS_MONEY_PAYMENT_ANTICIPATION_FEE_REFUND"),
  Type.Literal("ASAAS_MONEY_PAYMENT_FINANCING_FEE_REFUND"),
  Type.Literal("ASAAS_MONEY_TRANSACTION_CASHBACK_REFUND"),
  Type.Literal("ASAAS_MONEY_TRANSACTION_CHARGEBACK"),
  Type.Literal("ASAAS_MONEY_TRANSACTION_CHARGEBACK_REVERSAL"),
  Type.Literal("CHARGED_FEE_REFUND"),
  Type.Literal("PIX_TRANSACTION_DEBIT"),
  Type.Literal("PIX_TRANSACTION_DEBIT_REFUND"),
  Type.Literal("PIX_TRANSACTION_CREDIT"),
  Type.Literal("PIX_TRANSACTION_CREDIT_FEE"),
  Type.Literal("PIX_TRANSACTION_CREDIT_REFUND"),
  Type.Literal("PIX_TRANSACTION_CREDIT_REFUND_CANCELLATION"),
  Type.Literal("PIX_TRANSACTION_DEBIT_FEE"),
  Type.Literal("CREDIT_BUREAU_REPORT"),
  Type.Literal("CONTRACTUAL_EFFECT_SETTLEMENT"),
  Type.Literal("CONTRACTUAL_EFFECT_SETTLEMENT_REVERSAL"),
  Type.Literal("FREE_PAYMENT_USE"),
  Type.Literal("MOBILE_PHONE_RECHARGE"),
  Type.Literal("REFUND_MOBILE_PHONE_RECHARGE"),
  Type.Literal("CANCEL_MOBILE_PHONE_RECHARGE"),
  Type.Literal("BACEN_JUDICIAL_LOCK"),
  Type.Literal("BACEN_JUDICIAL_UNLOCK"),
  Type.Literal("BACEN_JUDICIAL_TRANSFER"),
  Type.Literal("INSTANT_TEXT_MESSAGE_FEE"),
  Type.Literal("ASAAS_DEBIT_CARD_REQUEST_FEE"),
  Type.Literal("ASAAS_PREPAID_CARD_REQUEST_FEE"),
  Type.Literal("EXTERNAL_SETTLEMENT_CONTRACTUAL_EFFECT_BATCH_CREDIT"),
  Type.Literal("EXTERNAL_SETTLEMENT_CONTRACTUAL_EFFECT_BATCH_REVERSAL"),
  Type.Literal("CHILD_ACCOUNT_KNOWN_YOUR_CUSTOMER_BATCH_FEE"),
  Type.Literal("CONTRACTED_CUSTOMER_PLAN_FEE"),
  Type.Literal("ACCOUNT_INACTIVITY_FEE"),
  Type.Literal("PAYMENT_ORIGIN_CHANNEL_FEE"),
  Type.Literal("PAYMENT_SPLIT_DIVERGENCE_BLOCK"),
  Type.Literal("PAYMENT_SPLIT_DIVERGENCE_BLOCK_REVERSAL"),
  Type.Literal("PAYMENT_SPLIT_FEE"),
  Type.Literal("ACCOUNT_OWNER_PAYMENT_CUSTODY_CONFIG_FEE"),
  Type.Literal("CUSTOMER_PAYMENT_CUSTODY_CONFIG_FEE"),
  Type.Literal("CARD_SALE_ITEM_FEE"),
  Type.Literal("CARD_SALE_ITEM_FEE_REVERSAL"),
  Type.Literal("CARD_SALE_RECEIVED"),
  Type.Literal("CARD_SALE_REVERSAL"),
  Type.Literal("FLAPP_STORE_PLAN_CHARGE_FEE"),
  Type.Literal("FLAPP_STORE_PLAN_CHARGE_FEE_CREDIT"),
  Type.Literal("RECEIVABLE_ANTICIPATION_PAYMENT_FEE"),
  Type.Literal("ASAAS_MONEY_DONATION_DEBIT"),
  Type.Literal("ASAAS_MONEY_DONATION_DEBIT_REFUND"),
  Type.Literal("ASAAS_MONEY_PAYMENT_ANTICIPATION_FEE"),
  Type.Literal("ASAAS_MONEY_PAYMENT_COMPROMISED_BALANCE"),
  Type.Literal("ASAAS_MONEY_PAYMENT_DEBIT"),
  Type.Literal("ASAAS_MONEY_PAYMENT_DEBIT_REFUND"),
  Type.Literal("ASAAS_MONEY_PAYMENT_FINANCING_FEE"),
  Type.Literal("ASAAS_MONEY_TRANSACTION_CASHBACK"),
  Type.Literal("CUSTOMER_ACCOUNT_PAYMENT_BONUS_FEE"),
  Type.Literal("CUSTOMER_COMMISSION_CHECKOUT"),
  Type.Literal("RECEIVABLE_ANTICIPATION_CREDIT"),
  Type.Literal("RECEIVABLE_ANTICIPATION_PARTNER_SETTLEMENT"),
])
export type FinancialTransactionType = (typeof FinancialTransactionType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const FineType = Type.Union([
  Type.Literal("FIXED"),
  Type.Literal("PERCENTAGE"),
])
export type FineType = (typeof FineType)['static']

export const InvoiceConfigStatus = Type.Union([
  Type.Literal("AWAITING_APPROVAL"),
  Type.Literal("APPROVED"),
  Type.Literal("REJECTED"),
])
export type InvoiceConfigStatus = (typeof InvoiceConfigStatus)['static']

/** Colapsa 3 schemas idênticos da spec. */
export const InvoiceStatus = Type.Union([
  Type.Literal("SCHEDULED"),
  Type.Literal("AUTHORIZED"),
  Type.Literal("PROCESSING_CANCELLATION"),
  Type.Literal("CANCELED"),
  Type.Literal("CANCELLATION_DENIED"),
  Type.Literal("ERROR"),
])
export type InvoiceStatus = (typeof InvoiceStatus)['static']

export const MobilePhoneRechargeStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("CONFIRMED"),
  Type.Literal("CANCELLED"),
  Type.Literal("REFUNDED"),
  Type.Literal("WAITING_CRITICAL_ACTION"),
])
export type MobilePhoneRechargeStatus = (typeof MobilePhoneRechargeStatus)['static']

export const MyAccountGetStatusResponseStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("APPROVED"),
  Type.Literal("REJECTED"),
  Type.Literal("AWAITING_APPROVAL"),
])
export type MyAccountGetStatusResponseStatus = (typeof MyAccountGetStatusResponseStatus)['static']

export const NotificationEvent = Type.Union([
  Type.Literal("PAYMENT_CREATED"),
  Type.Literal("PAYMENT_UPDATED"),
  Type.Literal("PAYMENT_RECEIVED"),
  Type.Literal("PAYMENT_OVERDUE"),
  Type.Literal("PAYMENT_DUEDATE_WARNING"),
  Type.Literal("SEND_LINHA_DIGITAVEL"),
])
export type NotificationEvent = (typeof NotificationEvent)['static']

/** Colapsa 3 schemas idênticos da spec. */
export const PaymentDocumentType = Type.Union([
  Type.Literal("INVOICE"),
  Type.Literal("CONTRACT"),
  Type.Literal("MEDIA"),
  Type.Literal("DOCUMENT"),
  Type.Literal("SPREADSHEET"),
  Type.Literal("PROGRAM"),
  Type.Literal("OTHER"),
])
export type PaymentDocumentType = (typeof PaymentDocumentType)['static']

export const PaymentDunningListRequestPaymentDunningType = Type.Union([
  Type.Literal("CREDIT_BUREAU"),
  Type.Literal("DEBT_RECOVERY_ASSISTANCE"),
])
export type PaymentDunningListRequestPaymentDunningType = (typeof PaymentDunningListRequestPaymentDunningType)['static']

/** Colapsa 4 schemas idênticos da spec. */
export const PaymentDunningStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("AWAITING_APPROVAL"),
  Type.Literal("AWAITING_CANCELLATION"),
  Type.Literal("PROCESSED"),
  Type.Literal("PAID"),
  Type.Literal("PARTIALLY_PAID"),
  Type.Literal("DENIED"),
  Type.Literal("CANCELLED"),
])
export type PaymentDunningStatus = (typeof PaymentDunningStatus)['static']

/** Colapsa 6 schemas idênticos da spec. */
export const PaymentDunningType = Type.Union([
  Type.Literal("CREDIT_BUREAU"),
])
export type PaymentDunningType = (typeof PaymentDunningType)['static']

export const PaymentEscrowFinishReason = Type.Union([
  Type.Literal("CHARGEBACK"),
  Type.Literal("EXPIRED"),
  Type.Literal("INSUFFICIENT_BALANCE"),
  Type.Literal("PAYMENT_REFUNDED"),
  Type.Literal("REQUESTED_BY_CUSTOMER"),
  Type.Literal("CUSTOMER_CONFIG_DISABLED"),
])
export type PaymentEscrowFinishReason = (typeof PaymentEscrowFinishReason)['static']

export const PaymentEscrowStatus = Type.Union([
  Type.Literal("ACTIVE"),
  Type.Literal("DONE"),
])
export type PaymentEscrowStatus = (typeof PaymentEscrowStatus)['static']

/** Colapsa 7 schemas idênticos da spec. */
export const PaymentGetResponseBillingType = Type.Union([
  Type.Literal("UNDEFINED"),
  Type.Literal("BOLETO"),
  Type.Literal("CREDIT_CARD"),
  Type.Literal("DEBIT_CARD"),
  Type.Literal("TRANSFER"),
  Type.Literal("DEPOSIT"),
  Type.Literal("PIX"),
])
export type PaymentGetResponseBillingType = (typeof PaymentGetResponseBillingType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PaymentRefundStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("AWAITING_CRITICAL_ACTION_AUTHORIZATION"),
  Type.Literal("AWAITING_CUSTOMER_EXTERNAL_AUTHORIZATION"),
  Type.Literal("CANCELLED"),
  Type.Literal("DONE"),
])
export type PaymentRefundStatus = (typeof PaymentRefundStatus)['static']

export const PaymentSimulateRequestBillingType = Type.Union([
  Type.Literal("UNDEFINED"),
  Type.Literal("BOLETO"),
  Type.Literal("CREDIT_CARD"),
  Type.Literal("MUNDIPAGG_CIELO"),
  Type.Literal("TRANSFER"),
  Type.Literal("DEPOSIT"),
  Type.Literal("DEBIT_CARD"),
  Type.Literal("PIX"),
  Type.Literal("VOUCHER_CARD"),
  Type.Literal("ASAAS_MONEY"),
])
export type PaymentSimulateRequestBillingType = (typeof PaymentSimulateRequestBillingType)['static']

/** Colapsa 3 schemas idênticos da spec. */
export const PaymentSplitCancellationReason = Type.Union([
  Type.Literal("PAYMENT_DELETED"),
  Type.Literal("PAYMENT_OVERDUE"),
  Type.Literal("PAYMENT_RECEIVED_IN_CASH"),
  Type.Literal("PAYMENT_REFUNDED"),
  Type.Literal("VALUE_DIVERGENCE_BLOCK"),
  Type.Literal("WALLET_UNABLE_TO_RECEIVE"),
])
export type PaymentSplitCancellationReason = (typeof PaymentSplitCancellationReason)['static']

/** Colapsa 5 schemas idênticos da spec. */
export const PaymentSplitStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("PROCESSING"),
  Type.Literal("PROCESSING_REFUND"),
  Type.Literal("AWAITING_CREDIT"),
  Type.Literal("CANCELLED"),
  Type.Literal("DONE"),
  Type.Literal("REFUNDED"),
  Type.Literal("BLOCKED_BY_VALUE_DIVERGENCE"),
])
export type PaymentSplitStatus = (typeof PaymentSplitStatus)['static']

/** Colapsa 7 schemas idênticos da spec. */
export const PaymentStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("RECEIVED"),
  Type.Literal("CONFIRMED"),
  Type.Literal("OVERDUE"),
  Type.Literal("REFUNDED"),
  Type.Literal("RECEIVED_IN_CASH"),
  Type.Literal("REFUND_REQUESTED"),
  Type.Literal("REFUND_IN_PROGRESS"),
  Type.Literal("CHARGEBACK_REQUESTED"),
  Type.Literal("CHARGEBACK_DISPUTE"),
  Type.Literal("AWAITING_CHARGEBACK_REVERSAL"),
  Type.Literal("DUNNING_REQUESTED"),
  Type.Literal("DUNNING_RECEIVED"),
  Type.Literal("AWAITING_RISK_ANALYSIS"),
  Type.Literal("AUTHORIZED"),
])
export type PaymentStatus = (typeof PaymentStatus)['static']

/** Colapsa 6 schemas idênticos da spec. */
export const PersonType = Type.Union([
  Type.Literal("JURIDICA"),
  Type.Literal("FISICA"),
])
export type PersonType = (typeof PersonType)['static']

export const PixAddressKeySaveRequestPixAddressKeyType = Type.Union([
  Type.Literal("EVP"),
])
export type PixAddressKeySaveRequestPixAddressKeyType = (typeof PixAddressKeySaveRequestPixAddressKeyType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixAddressKeyStatus = Type.Union([
  Type.Literal("AWAITING_ACTIVATION"),
  Type.Literal("ACTIVE"),
  Type.Literal("AWAITING_DELETION"),
  Type.Literal("AWAITING_ACCOUNT_DELETION"),
  Type.Literal("DELETED"),
  Type.Literal("ERROR"),
])
export type PixAddressKeyStatus = (typeof PixAddressKeyStatus)['static']

/** Colapsa 5 schemas idênticos da spec. */
export const PixAddressKeyType = Type.Union([
  Type.Literal("CPF"),
  Type.Literal("CNPJ"),
  Type.Literal("EMAIL"),
  Type.Literal("PHONE"),
  Type.Literal("EVP"),
])
export type PixAddressKeyType = (typeof PixAddressKeyType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixAutomaticRecurringAuthorizationRetryPolicy = Type.Union([
  Type.Literal("ALLOW_THREE_IN_SEVEN_DAYS"),
  Type.Literal("NOT_ALLOWED"),
])
export type PixAutomaticRecurringAuthorizationRetryPolicy = (typeof PixAutomaticRecurringAuthorizationRetryPolicy)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixAutomaticRecurringFrequency = Type.Union([
  Type.Literal("WEEKLY"),
  Type.Literal("MONTHLY"),
  Type.Literal("QUARTERLY"),
  Type.Literal("SEMIANNUALLY"),
  Type.Literal("ANNUALLY"),
])
export type PixAutomaticRecurringFrequency = (typeof PixAutomaticRecurringFrequency)['static']

export const PixAutomaticRecurringOriginType = Type.Union([
  Type.Literal("IMMEDIATE_PAYMENT_AND_RECURRING_QR_CODE"),
  Type.Literal("PAYMENT_AND_RECURRING_OFFER_QR_CODE"),
])
export type PixAutomaticRecurringOriginType = (typeof PixAutomaticRecurringOriginType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixAutomaticRecurringPaymentCreationMode = Type.Union([
  Type.Literal("MANUAL"),
  Type.Literal("SUBSCRIPTION"),
])
export type PixAutomaticRecurringPaymentCreationMode = (typeof PixAutomaticRecurringPaymentCreationMode)['static']

export const PixAutomaticRecurringPaymentInstructionStatus = Type.Union([
  Type.Literal("AWAITING_REQUEST"),
  Type.Literal("SCHEDULED"),
  Type.Literal("DONE"),
  Type.Literal("CANCELLED"),
  Type.Literal("REFUSED"),
])
export type PixAutomaticRecurringPaymentInstructionStatus = (typeof PixAutomaticRecurringPaymentInstructionStatus)['static']

export const PixQrCodeDecodeReceiverPixAccountType = Type.Union([
  Type.Literal("CHECKING_ACCOUNT"),
  Type.Literal("SALARY_ACCOUNT"),
  Type.Literal("INVESTIMENT_ACCOUNT"),
  Type.Literal("PAYMENT_ACCOUNT"),
  Type.Literal("INSTANT_PAYMENT_ACCOUNT"),
])
export type PixQrCodeDecodeReceiverPixAccountType = (typeof PixQrCodeDecodeReceiverPixAccountType)['static']

export const PixQrCodeType = Type.Union([
  Type.Literal("STATIC"),
  Type.Literal("DYNAMIC"),
  Type.Literal("DYNAMIC_WITH_ASAAS_ADDRESS_KEY"),
  Type.Literal("COMPOSITE"),
])
export type PixQrCodeType = (typeof PixQrCodeType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixReceiverAutomaticRecurringAuthorizationStatus = Type.Union([
  Type.Literal("CREATED"),
  Type.Literal("ACTIVE"),
  Type.Literal("CANCELLED"),
  Type.Literal("REFUSED"),
  Type.Literal("EXPIRED"),
])
export type PixReceiverAutomaticRecurringAuthorizationStatus = (typeof PixReceiverAutomaticRecurringAuthorizationStatus)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixRecurringTransactionFrequency = Type.Union([
  Type.Literal("WEEKLY"),
  Type.Literal("MONTHLY"),
])
export type PixRecurringTransactionFrequency = (typeof PixRecurringTransactionFrequency)['static']

export const PixRecurringTransactionItemStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("CANCELLED"),
  Type.Literal("REFUSED"),
  Type.Literal("DONE"),
])
export type PixRecurringTransactionItemStatus = (typeof PixRecurringTransactionItemStatus)['static']

export const PixRecurringTransactionOrigin = Type.Union([
  Type.Literal("PIX"),
])
export type PixRecurringTransactionOrigin = (typeof PixRecurringTransactionOrigin)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixRecurringTransactionStatus = Type.Union([
  Type.Literal("AWAITING_CRITICAL_ACTION_AUTHORIZATION"),
  Type.Literal("PENDING"),
  Type.Literal("SCHEDULED"),
  Type.Literal("CANCELLED"),
  Type.Literal("DONE"),
])
export type PixRecurringTransactionStatus = (typeof PixRecurringTransactionStatus)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixTransactionCashValueFinality = Type.Union([
  Type.Literal("WITHDRAWAL"),
  Type.Literal("CHANGE"),
])
export type PixTransactionCashValueFinality = (typeof PixTransactionCashValueFinality)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixTransactionOriginType = Type.Union([
  Type.Literal("MANUAL"),
  Type.Literal("ADDRESS_KEY"),
  Type.Literal("STATIC_QRCODE"),
  Type.Literal("DYNAMIC_QRCODE"),
  Type.Literal("PAYMENT_INITIATION_SERVICE"),
  Type.Literal("AUTOMATIC_RECURRING"),
])
export type PixTransactionOriginType = (typeof PixTransactionOriginType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixTransactionStatus = Type.Union([
  Type.Literal("AWAITING_BALANCE_VALIDATION"),
  Type.Literal("AWAITING_INSTANT_PAYMENT_ACCOUNT_BALANCE"),
  Type.Literal("AWAITING_CRITICAL_ACTION_AUTHORIZATION"),
  Type.Literal("AWAITING_CHECKOUT_RISK_ANALYSIS_REQUEST"),
  Type.Literal("AWAITING_CASH_IN_RISK_ANALYSIS_REQUEST"),
  Type.Literal("SCHEDULED"),
  Type.Literal("AWAITING_REQUEST"),
  Type.Literal("REQUESTED"),
  Type.Literal("DONE"),
  Type.Literal("REFUSED"),
  Type.Literal("CANCELLED"),
])
export type PixTransactionStatus = (typeof PixTransactionStatus)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const PixTransactionType = Type.Union([
  Type.Literal("DEBIT"),
  Type.Literal("CREDIT"),
  Type.Literal("CREDIT_REFUND"),
  Type.Literal("DEBIT_REFUND"),
  Type.Literal("DEBIT_REFUND_CANCELLATION"),
])
export type PixTransactionType = (typeof PixTransactionType)['static']

export const Status = Type.Union([
  Type.Literal("APPROVED"),
  Type.Literal("AWAITING_ACTION_AUTHORIZATION"),
  Type.Literal("DENIED"),
  Type.Literal("PENDING"),
])
export type Status = (typeof Status)['static']

export const SubscriptionGetInvoicesRequestInvoiceStatus = Type.Union([
  Type.Literal("SCHEDULED"),
  Type.Literal("WAITING_OVERDUE_PAYMENT"),
  Type.Literal("PENDING"),
  Type.Literal("SYNCHRONIZED"),
  Type.Literal("AUTHORIZED"),
  Type.Literal("PROCESSING_CANCELLATION"),
  Type.Literal("CANCELLED"),
  Type.Literal("CANCELLATION_DENIED"),
  Type.Literal("ERROR"),
  Type.Literal("NONE"),
  Type.Literal("CANCELED"),
])
export type SubscriptionGetInvoicesRequestInvoiceStatus = (typeof SubscriptionGetInvoicesRequestInvoiceStatus)['static']

export const SubscriptionSplitDisabledReason = Type.Union([
  Type.Literal("WALLET_UNABLE_TO_RECEIVE"),
  Type.Literal("VALUE_DIVERGENCE"),
])
export type SubscriptionSplitDisabledReason = (typeof SubscriptionSplitDisabledReason)['static']

export const SubscriptionSplitStatus = Type.Union([
  Type.Literal("ACTIVE"),
  Type.Literal("DISABLED"),
])
export type SubscriptionSplitStatus = (typeof SubscriptionSplitStatus)['static']

/** Colapsa 3 schemas idênticos da spec. */
export const SubscriptionStatus = Type.Union([
  Type.Literal("ACTIVE"),
  Type.Literal("EXPIRED"),
  Type.Literal("INACTIVE"),
])
export type SubscriptionStatus = (typeof SubscriptionStatus)['static']

export const SubscriptionUpdateRequestSubscriptionStatus = Type.Union([
  Type.Literal("ACTIVE"),
  Type.Literal("INACTIVE"),
])
export type SubscriptionUpdateRequestSubscriptionStatus = (typeof SubscriptionUpdateRequestSubscriptionStatus)['static']

export const TransferSaveRequestTransferType = Type.Union([
  Type.Literal("PIX"),
  Type.Literal("TED"),
])
export type TransferSaveRequestTransferType = (typeof TransferSaveRequestTransferType)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const TransferStatus = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("BANK_PROCESSING"),
  Type.Literal("DONE"),
  Type.Literal("CANCELLED"),
  Type.Literal("FAILED"),
])
export type TransferStatus = (typeof TransferStatus)['static']

/** Colapsa 2 schemas idênticos da spec. */
export const TransferType = Type.Union([
  Type.Literal("PIX"),
  Type.Literal("TED"),
  Type.Literal("INTERNAL"),
])
export type TransferType = (typeof TransferType)['static']

/** Colapsa 3 schemas idênticos da spec. */
export const WebhookEvent = Type.Union([
  Type.Literal("PAYMENT_AUTHORIZED"),
  Type.Literal("PAYMENT_AWAITING_RISK_ANALYSIS"),
  Type.Literal("PAYMENT_APPROVED_BY_RISK_ANALYSIS"),
  Type.Literal("PAYMENT_REPROVED_BY_RISK_ANALYSIS"),
  Type.Literal("PAYMENT_CREATED"),
  Type.Literal("PAYMENT_UPDATED"),
  Type.Literal("PAYMENT_CONFIRMED"),
  Type.Literal("PAYMENT_RECEIVED"),
  Type.Literal("PAYMENT_ANTICIPATED"),
  Type.Literal("PAYMENT_OVERDUE"),
  Type.Literal("PAYMENT_DELETED"),
  Type.Literal("PAYMENT_RESTORED"),
  Type.Literal("PAYMENT_REFUNDED"),
  Type.Literal("PAYMENT_REFUND_IN_PROGRESS"),
  Type.Literal("PAYMENT_REFUND_DENIED"),
  Type.Literal("PAYMENT_RECEIVED_IN_CASH_UNDONE"),
  Type.Literal("PAYMENT_CHARGEBACK_REQUESTED"),
  Type.Literal("PAYMENT_CHARGEBACK_DISPUTE"),
  Type.Literal("PAYMENT_AWAITING_CHARGEBACK_REVERSAL"),
  Type.Literal("PAYMENT_DUNNING_RECEIVED"),
  Type.Literal("PAYMENT_DUNNING_REQUESTED"),
  Type.Literal("PAYMENT_BANK_SLIP_CANCELLED"),
  Type.Literal("PAYMENT_BANK_SLIP_VIEWED"),
  Type.Literal("PAYMENT_CHECKOUT_VIEWED"),
  Type.Literal("PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"),
  Type.Literal("PAYMENT_PARTIALLY_REFUNDED"),
  Type.Literal("PAYMENT_SPLIT_CANCELLED"),
  Type.Literal("PAYMENT_SPLIT_DIVERGENCE_BLOCK"),
  Type.Literal("PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED"),
  Type.Literal("INVOICE_CREATED"),
  Type.Literal("INVOICE_UPDATED"),
  Type.Literal("INVOICE_SYNCHRONIZED"),
  Type.Literal("INVOICE_AUTHORIZED"),
  Type.Literal("INVOICE_PROCESSING_CANCELLATION"),
  Type.Literal("INVOICE_CANCELED"),
  Type.Literal("INVOICE_CANCELLATION_DENIED"),
  Type.Literal("INVOICE_ERROR"),
  Type.Literal("TRANSFER_CREATED"),
  Type.Literal("TRANSFER_PENDING"),
  Type.Literal("TRANSFER_IN_BANK_PROCESSING"),
  Type.Literal("TRANSFER_BLOCKED"),
  Type.Literal("TRANSFER_DONE"),
  Type.Literal("TRANSFER_FAILED"),
  Type.Literal("TRANSFER_CANCELLED"),
  Type.Literal("BILL_CREATED"),
  Type.Literal("BILL_PENDING"),
  Type.Literal("BILL_BANK_PROCESSING"),
  Type.Literal("BILL_PAID"),
  Type.Literal("BILL_CANCELLED"),
  Type.Literal("BILL_FAILED"),
  Type.Literal("BILL_REFUNDED"),
  Type.Literal("RECEIVABLE_ANTICIPATION_CANCELLED"),
  Type.Literal("RECEIVABLE_ANTICIPATION_SCHEDULED"),
  Type.Literal("RECEIVABLE_ANTICIPATION_PENDING"),
  Type.Literal("RECEIVABLE_ANTICIPATION_CREDITED"),
  Type.Literal("RECEIVABLE_ANTICIPATION_DEBITED"),
  Type.Literal("RECEIVABLE_ANTICIPATION_DENIED"),
  Type.Literal("RECEIVABLE_ANTICIPATION_OVERDUE"),
  Type.Literal("MOBILE_PHONE_RECHARGE_PENDING"),
  Type.Literal("MOBILE_PHONE_RECHARGE_CANCELLED"),
  Type.Literal("MOBILE_PHONE_RECHARGE_CONFIRMED"),
  Type.Literal("MOBILE_PHONE_RECHARGE_REFUNDED"),
  Type.Literal("ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED"),
  Type.Literal("ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL"),
  Type.Literal("ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING"),
  Type.Literal("ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED"),
  Type.Literal("ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED"),
  Type.Literal("ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL"),
  Type.Literal("ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED"),
  Type.Literal("ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON"),
  Type.Literal("ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING"),
  Type.Literal("ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED"),
  Type.Literal("ACCOUNT_STATUS_DOCUMENT_APPROVED"),
  Type.Literal("ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL"),
  Type.Literal("ACCOUNT_STATUS_DOCUMENT_PENDING"),
  Type.Literal("ACCOUNT_STATUS_DOCUMENT_REJECTED"),
  Type.Literal("ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED"),
  Type.Literal("ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL"),
  Type.Literal("ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING"),
  Type.Literal("ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED"),
  Type.Literal("SUBSCRIPTION_CREATED"),
  Type.Literal("SUBSCRIPTION_UPDATED"),
  Type.Literal("SUBSCRIPTION_INACTIVATED"),
  Type.Literal("SUBSCRIPTION_DELETED"),
  Type.Literal("SUBSCRIPTION_SPLIT_DISABLED"),
  Type.Literal("SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK"),
  Type.Literal("SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED"),
  Type.Literal("CHECKOUT_CREATED"),
  Type.Literal("CHECKOUT_CANCELED"),
  Type.Literal("CHECKOUT_EXPIRED"),
  Type.Literal("CHECKOUT_PAID"),
  Type.Literal("BALANCE_VALUE_BLOCKED"),
  Type.Literal("BALANCE_VALUE_UNBLOCKED"),
  Type.Literal("INTERNAL_TRANSFER_CREDIT"),
  Type.Literal("INTERNAL_TRANSFER_DEBIT"),
  Type.Literal("ACCESS_TOKEN_CREATED"),
  Type.Literal("ACCESS_TOKEN_DELETED"),
  Type.Literal("ACCESS_TOKEN_DISABLED"),
  Type.Literal("ACCESS_TOKEN_ENABLED"),
  Type.Literal("ACCESS_TOKEN_EXPIRED"),
  Type.Literal("ACCESS_TOKEN_EXPIRING_SOON"),
  Type.Literal("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED"),
  Type.Literal("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED"),
  Type.Literal("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED"),
  Type.Literal("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED"),
  Type.Literal("PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED"),
  Type.Literal("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED"),
  Type.Literal("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_SCHEDULED"),
  Type.Literal("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED"),
  Type.Literal("PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CANCELLED"),
  Type.Literal("PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED"),
])
export type WebhookEvent = (typeof WebhookEvent)['static']

/** Colapsa 3 schemas idênticos da spec. */
export const WebhookSendType = Type.Union([
  Type.Literal("NON_SEQUENTIALLY"),
  Type.Literal("SEQUENTIALLY"),
])
export type WebhookSendType = (typeof WebhookSendType)['static']
