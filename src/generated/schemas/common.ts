// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { BillingType, ChargebackDisputeStatus, ChargebackReason, ChargebackStatus, CreditCardBrand, FineType, InvoiceStatus, MyAccountGetStatusResponseStatus, NotificationEvent, PaymentEscrowFinishReason, PaymentEscrowStatus, PaymentGetResponseBillingType, PaymentRefundStatus, PaymentSplitCancellationReason, PaymentSplitStatus, PaymentStatus, WebhookEvent, WebhookSendType } from '../enums.ts'

/** Information about the expiration of commercial data */
export const AccountInfoCommercialInfoExpirationResponse = Type.Object({
    "isExpired": Type.Optional(Nullable(Type.Boolean({ description: "Informs if commercial data is expired", examples: [false] }))),
    "scheduledDate": Type.Optional(Nullable(Type.String({ description: "Informs the expiration date of commercial data", examples: ["2025-05-05 00:00:00"] }))),
  })
export type AccountInfoCommercialInfoExpirationResponse = (typeof AccountInfoCommercialInfoExpirationResponse)['static']

/** Credit card information */
export const ChargebackCreditCardResponse = Type.Object({
    "number": Type.Optional(Nullable(Type.String({ description: "Last 4 digits of the card used", examples: ["8829"] }))),
    "brand": Type.Optional(Nullable(CreditCardBrand)),
  })
export type ChargebackCreditCardResponse = (typeof ChargebackCreditCardResponse)['static']

/** Credit card holder information */
export const CreditCardHolderInfoRequest = Type.Object({
    "name": Type.String({ description: "Name of card holder", examples: ["John Doe"] }),
    "email": Type.String({ description: "Cardholder email", examples: ["john.doe@asaas.com"] }),
    "cpfCnpj": Type.String({ description: "CPF or CNPJ of the cardholder", examples: ["12345678901"] }),
    "postalCode": Type.String({ description: "Cardholder zip code", examples: ["12345678"] }),
    "addressNumber": Type.String({ description: "Cardholder address number", examples: ["123"] }),
    "addressComplement": Type.Optional(Nullable(Type.String({ description: "Supplementing the cardholder's address", examples: [null] }))),
    "phone": Type.String({ description: "Phone with cardholder's area code", examples: [null] }),
    "mobilePhone": Type.Optional(Nullable(Type.String({ description: "Cardholder's cell phone", examples: [null] }))),
  })
export type CreditCardHolderInfoRequest = (typeof CreditCardHolderInfoRequest)['static']

/** Credit card information */
export const CreditCardRequest = Type.Object({
    "holderName": Type.String({ description: "Name printed on card", examples: ["John Doe"] }),
    "number": Type.String({ description: "Card number", examples: ["1234567890123456"] }),
    "expiryMonth": Type.String({ description: "Expiration month with 2 digits", examples: ["7"] }),
    "expiryYear": Type.String({ description: "Expiration year with 4 digits", examples: ["2026"] }),
    "ccv": Type.String({ description: "Security code", examples: ["123"] }),
  })
export type CreditCardRequest = (typeof CreditCardRequest)['static']

export const CreditCardTokenizeResponse = Type.Object({
    "creditCardNumber": Type.Optional(Nullable(Type.String({ description: "Last 4 digits of the card used", examples: ["8829"] }))),
    "creditCardBrand": Type.Optional(Nullable(CreditCardBrand)),
    "creditCardToken": Type.Optional(Nullable(Type.String({ description: "Credit card token that can be sent in future transactions without the need to re-enter card and cardholder details.", examples: ["a75a1d98-c52d-4a6b-a413-71e00b193c99"] }))),
  })
export type CreditCardTokenizeResponse = (typeof CreditCardTokenizeResponse)['static']

/** List of objects */
export const ErrorResponseItem = Type.Object({
    "code": Type.Optional(Nullable(Type.String({ description: "Error code", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Error description", examples: [null] }))),
  })
export type ErrorResponseItem = (typeof ErrorResponseItem)['static']

export const ErrorResponse = Type.Object({
    "errors": Type.Optional(Nullable(Type.Array(ErrorResponseItem))),
  })
export type ErrorResponse = (typeof ErrorResponse)['static']

/** File */
export const File = Type.Any()
export type File = (typeof File)['static']

/** Invoice taxes */
export const InvoiceTaxesResponse = Type.Object({
    "nbsCode": Type.Optional(Nullable(Type.String({ description: "NBS Code (Brazilian Nomenclature of Services)", examples: ["1.0101.11.00"] }))),
    "taxSituationCode": Type.Optional(Nullable(Type.String({ description: "Tax situation code", examples: ["011"] }))),
    "taxClassificationCode": Type.Optional(Nullable(Type.String({ description: "Tax classification code", examples: ["011001"] }))),
    "operationIndicatorCode": Type.Optional(Nullable(Type.String({ description: "Operation indicator code", examples: ["020101"] }))),
    "retainIss": Type.Boolean({ description: "The invoice holder must withhold ISS or not", examples: [true] }),
    "iss": Type.Number({ description: "ISS tax percentage", examples: [2] }),
    "pisCofinsRetentionType": Type.Optional(Nullable(Type.String({ description: "PIS/COFINS retention type. Do not send this field in the request; it is automatically calculated by Asaas based on the PIS, COFINS and CSLL percentages. Use the value returned in the response for reconciliation purposes", examples: ["NOT_WITHHELD"] }))),
    "pisCofinsTaxStatus": Type.Optional(Nullable(Type.String({ description: "PIS/COFINS tax status", examples: ["STANDARD_TAXABLE_OPERATION"] }))),
    "operationPis": Type.Optional(Nullable(Type.Number({ description: "Operation PIS percentage (taxpayer's own assessment)", examples: [0.65] }))),
    "operationCofins": Type.Optional(Nullable(Type.Number({ description: "Operation COFINS percentage (taxpayer's own assessment)", examples: [3] }))),
    "pis": Type.Number({ description: "PIS tax percentage", examples: [0.65] }),
    "cofins": Type.Number({ description: "COFINS tax percentage", examples: [3] }),
    "csll": Type.Number({ description: "CSLL tax percentage", examples: [9] }),
    "inss": Type.Number({ description: "INSS tax percentage", examples: [11] }),
    "ir": Type.Number({ description: "IR tax percentage", examples: [1.5] }),
    "stateIbs": Type.Optional(Nullable(Type.Number({ description: "State IBS percentage", examples: [0.1] }))),
    "stateIbsValue": Type.Optional(Nullable(Type.Number({ description: "State IBS value", examples: [0.3] }))),
    "municipalIbs": Type.Optional(Nullable(Type.Number({ description: "Municipal IBS percentage", examples: [0] }))),
    "municipalIbsValue": Type.Optional(Nullable(Type.Number({ description: "Municipal IBS value", examples: [0] }))),
    "cbs": Type.Optional(Nullable(Type.Number({ description: "CBS percentage", examples: [0.9] }))),
    "cbsValue": Type.Optional(Nullable(Type.Number({ description: "CBS value", examples: [2.7] }))),
  })
export type InvoiceTaxesResponse = (typeof InvoiceTaxesResponse)['static']

export const InvoiceGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["invoice"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique invoice identifier in Asaas", examples: ["inv_000000000232"] }))),
    "status": Type.Optional(Nullable(InvoiceStatus)),
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier", examples: ["cus_000000002750"] }))),
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique payment identifier in Asaas", examples: ["pay_145059895800"] }))),
    "installment": Type.Optional(Nullable(Type.String({ description: "Unique installment identifier in Asaas", examples: [null] }))),
    "type": Type.Optional(Nullable(Type.Union([Type.Literal("NFS-e")]))),
    "statusDescription": Type.Optional(Nullable(Type.String({ description: "Description of the current status of the invoice", examples: [null] }))),
    "serviceDescription": Type.Optional(Nullable(Type.String({ description: "Description of invoice services", examples: ["Invoice 101940.\nDescription of Services: SYSTEMS ANALYSIS AND DEVELOPMENT"] }))),
    "pdfUrl": Type.Optional(Nullable(Type.String({ description: "Link to pdf file of the invoice issued", examples: [null] }))),
    "xmlUrl": Type.Optional(Nullable(Type.String({ description: "Link to xml file of the issued invoice", examples: [null] }))),
    "rpsSerie": Type.Optional(Nullable(Type.String({ description: "Invoice series", examples: [null] }))),
    "rpsNumber": Type.Optional(Nullable(Type.String({ description: "RPS converted to invoice", examples: [null] }))),
    "number": Type.Optional(Nullable(Type.String({ description: "Invoice number", examples: [null] }))),
    "validationCode": Type.Optional(Nullable(Type.String({ description: "Verification code", examples: [null] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Total value", examples: [300] }))),
    "deductions": Type.Optional(Nullable(Type.Number({ description: "Deductions. Deductions do not change the total value of the invoice, but they do change the ISS calculation basis.", examples: [10] }))),
    "effectiveDate": Type.Optional(Nullable(Type.String({ description: "Invoice issuance date", examples: ["2024-08-15"] }))),
    "observations": Type.Optional(Nullable(Type.String({ description: "Additional observations", examples: ["Monthly for June work."] }))),
    "estimatedTaxesDescription": Type.Optional(Nullable(Type.String({ description: "Estimated tax invoice", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Invoice identifier in your system", examples: [null] }))),
    "taxes": Type.Optional(Nullable(InvoiceTaxesResponse)),
    "municipalServiceId": Type.Optional(Nullable(Type.String({ description: "Unique municipal service identifier", examples: [null] }))),
    "municipalServiceCode": Type.Optional(Nullable(Type.String({ description: "Municipal Service Code", examples: ["1.01"] }))),
    "municipalServiceName": Type.Optional(Nullable(Type.String({ description: "Name of municipal service", examples: ["Systems analysis and development"] }))),
  })
export type InvoiceGetResponse = (typeof InvoiceGetResponse)['static']

export const InvoiceListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(InvoiceGetResponse))),
  })
export type InvoiceListResponse = (typeof InvoiceListResponse)['static']

/** Invoice taxes */
export const InvoiceTaxesRequest = Type.Object({
    "nbsCode": Type.Optional(Nullable(Type.String({ description: "NBS Code (Brazilian Nomenclature of Services)", examples: ["1.0101.11.00"] }))),
    "taxSituationCode": Type.Optional(Nullable(Type.String({ description: "Tax situation code", examples: ["011"] }))),
    "taxClassificationCode": Type.Optional(Nullable(Type.String({ description: "Tax classification code", examples: ["011001"] }))),
    "operationIndicatorCode": Type.Optional(Nullable(Type.String({ description: "Operation indicator code", examples: ["020101"] }))),
    "retainIss": Type.Boolean({ description: "The invoice holder must withhold ISS or not", examples: [true] }),
    "iss": Type.Number({ description: "ISS tax percentage", examples: [2] }),
    "pisCofinsRetentionType": Type.Optional(Nullable(Type.String({ description: "PIS/COFINS retention type. Do not send this field in the request; it is automatically calculated by Asaas based on the PIS, COFINS and CSLL percentages. Use the value returned in the response for reconciliation purposes", examples: ["NOT_WITHHELD"] }))),
    "pisCofinsTaxStatus": Type.Optional(Nullable(Type.String({ description: "PIS/COFINS tax status", examples: ["STANDARD_TAXABLE_OPERATION"] }))),
    "operationPis": Type.Optional(Nullable(Type.Number({ description: "Operation PIS percentage (taxpayer's own assessment)", examples: [0.65] }))),
    "operationCofins": Type.Optional(Nullable(Type.Number({ description: "Operation COFINS percentage (taxpayer's own assessment)", examples: [3] }))),
    "useTaxSystemReformNT007": Type.Optional(Nullable(Type.Boolean({ description: "Allows the early use of the NT-007 PIS/COFINS validations and normalizations for Regime Normal customers during the migration. As of 06/30, the rules will be applied by default", examples: [true] }))),
    "pis": Type.Number({ description: "PIS tax percentage", examples: [0.65] }),
    "cofins": Type.Number({ description: "COFINS tax percentage", examples: [3] }),
    "csll": Type.Number({ description: "CSLL tax percentage", examples: [9] }),
    "inss": Type.Number({ description: "INSS tax percentage", examples: [11] }),
    "ir": Type.Number({ description: "IR tax percentage", examples: [1.5] }),
  })
export type InvoiceTaxesRequest = (typeof InvoiceTaxesRequest)['static']

/** Split Settings */
export const LeanPaymentSplitGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique split identifier in Asaas", examples: ["fd41396a-7453-47d0-9411-c8543522591d"] }))),
    "walletId": Type.Optional(Nullable(Type.String({ description: "Asaas wallet identifier that will be transferred", examples: ["7bafd95a-e783-4a62-9be1-23999af742c6"] }))),
    "fixedValue": Type.Optional(Nullable(Type.Number({ description: "Fixed amount to be transferred to the account when the charge is received", examples: [20.32] }))),
    "percentualValue": Type.Optional(Nullable(Type.Number({ description: "Percentage of the net value of the charge to be transferred when received", examples: [null] }))),
    "totalValue": Type.Optional(Nullable(Type.Number({ description: "Amount that will be split relative to the total amount that will be paid. The displayed values may be updated after the payment is confirmed or modified.", examples: [20.32] }))),
    "cancellationReason": Type.Optional(Nullable(PaymentSplitCancellationReason)),
    "status": Type.Optional(Nullable(PaymentSplitStatus)),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Unique identifier of split in your system", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Split description", examples: [null] }))),
  })
export type LeanPaymentSplitGetResponse = (typeof LeanPaymentSplitGetResponse)['static']

export const MyAccountGetStatusResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique account identifier in Asaas", examples: ["a910f50b-8745-4bc6-89fe-f1931c6a2e05"] }))),
    "commercialInfo": Type.Optional(Nullable(MyAccountGetStatusResponseStatus)),
    "bankAccountInfo": Type.Optional(Nullable(MyAccountGetStatusResponseStatus)),
    "documentation": Type.Optional(Nullable(MyAccountGetStatusResponseStatus)),
    "general": Type.Optional(Nullable(MyAccountGetStatusResponseStatus)),
  })
export type MyAccountGetStatusResponse = (typeof MyAccountGetStatusResponse)['static']

/** List of notification information */
export const NotificationGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["notification"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique notification identifier", examples: ["not_wuGp97JeCr7G"] }))),
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier", examples: ["cus_000005401844"] }))),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether notification is enabled", examples: [true] }))),
    "emailEnabledForProvider": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the email sent to you is enabled or disabled", examples: [true] }))),
    "smsEnabledForProvider": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the SMS sent to you is enabled or disabled", examples: [true] }))),
    "emailEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the email sent to the customer is enabled or disabled", examples: [true] }))),
    "smsEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the SMS sent to the customer is enabled or disabled", examples: [true] }))),
    "phoneCallEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether voice notification to the customer is enabled or disabled", examples: [false] }))),
    "whatsappEnabledForCustomer": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the WhatsApp notification sent to the customer is enabled or disabled", examples: [false] }))),
    "event": Type.Optional(Nullable(NotificationEvent)),
    "scheduleOffset": Type.Optional(Nullable(Type.Integer({ description: "Specifies how many days before the due date the notification must be sent. Valid only for the `PAYMENT_DUEDATE_WARNING` and `PAYMENT_OVERDUE` events", examples: [1] }))),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the notification was deleted", examples: [true] }))),
  })
export type NotificationGetResponse = (typeof NotificationGetResponse)['static']

/** Automatic redirection information after the payment of the link payment */
export const PaymentCallbackRequest = Type.Object({
    "successUrl": Type.String({ description: "URL that the customer will be redirected to after successful payment of the invoice or payment link", examples: [null] }),
    "autoRedirect": Type.Optional(Nullable(Type.Boolean({ description: "Define whether the customer will be automatically redirected or will just be informed with a button to return to the website. The default is true, if you want to disable it, enter false", examples: [null] }))),
  })
export type PaymentCallbackRequest = (typeof PaymentCallbackRequest)['static']

export const PaymentChargebackResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique chargeback identifier.", examples: ["8e784c3e-afe8-4844-bb93-6b445763"] }))),
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique payment identifier in Asaas", examples: ["pay_pBtDdshgBD2Rt"] }))),
    "installment": Type.Optional(Nullable(Type.String({ description: "Unique installment identifier in Asaas", examples: ["b8dd74c-d078-40a0-9ae1-61a66c61a204"] }))),
    "customerAccount": Type.Optional(Nullable(Type.String({ description: "Unique identifier of customer to which the chargeback is linked.", examples: ["cus_000000004085"] }))),
    "status": Type.Optional(Nullable(ChargebackStatus)),
    "reason": Type.Optional(Nullable(ChargebackReason)),
    "disputeStartDate": Type.Optional(Nullable(Type.String({ description: "Chargeback opening date.", examples: ["2024-11-10"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Chargeback value.", examples: [2323.45] }))),
    "paymentDate": Type.Optional(Nullable(Type.String({ description: "Payment date on Asaas", examples: ["2024-03-10"] }))),
    "creditCard": Type.Optional(Nullable(ChargebackCreditCardResponse)),
    "disputeStatus": Type.Optional(Nullable(ChargebackDisputeStatus)),
    "deadlineToSendDisputeDocuments": Type.Optional(Nullable(Type.String({ description: "Deadline to send dispute documents.", examples: ["2024-12-10"] }))),
  })
export type PaymentChargebackResponse = (typeof PaymentChargebackResponse)['static']

export const PaymentDeleteResponse = Type.Object({
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the charge has been removed", examples: [true] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique payment identifier in Asaas", examples: ["pay_pCczZjBBr6RL"] }))),
  })
export type PaymentDeleteResponse = (typeof PaymentDeleteResponse)['static']

/** Discount information */
export const PaymentDiscount = Type.Object({
    "value": Type.Optional(Nullable(Type.Number({ description: "Percentage or fixed amount of discount to be applied to the Payment amount", examples: [10] }))),
    "dueDateLimitDays": Type.Optional(Nullable(Type.Integer({ description: "Days before expiration to apply discount. Ex: 0 = until expiration, 1 = up to one day before, 2 = up to 2 days before, and so on", examples: [0] }))),
    "type": Type.Optional(Nullable(FineType)),
  })
export type PaymentDiscount = (typeof PaymentDiscount)['static']

/** Payment escrow in the Escrow Account information */
export const PaymentEscrowGetResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique payment escrow identifier in Asaas", examples: ["4f468235-cec3-482f-b3d0-348af4c7194"] }))),
    "status": Type.Optional(Nullable(PaymentEscrowStatus)),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "Payment escrow expiration date", examples: ["2024-06-10"] }))),
    "finishDate": Type.Optional(Nullable(Type.String({ description: "Payment escrow finish date", examples: ["2024-06-10"] }))),
    "finishReason": Type.Optional(Nullable(PaymentEscrowFinishReason)),
  })
export type PaymentEscrowGetResponse = (typeof PaymentEscrowGetResponse)['static']

/** Fine information for payment after due date */
export const PaymentFineRequest = Type.Object({
    "value": Type.Optional(Nullable(Type.Number({ description: "Percentage of fine on the amount of the charge for payment after the due date", examples: [null] }))),
    "type": Type.Optional(Nullable(FineType)),
  })
export type PaymentFineRequest = (typeof PaymentFineRequest)['static']

/** Fine information for payment after due date */
export const PaymentFineResponse = Type.Object({
    "value": Type.Optional(Nullable(Type.Number({ description: "Fine amount in percentage", examples: [1] }))),
  })
export type PaymentFineResponse = (typeof PaymentFineResponse)['static']

/** Credit card information */
export const PaymentSaveWithCreditCardCreditCard = Type.Object({
    "creditCardNumber": Type.Optional(Nullable(Type.String({ description: "Last 4 digits of the card used", examples: ["8829"] }))),
    "creditCardBrand": Type.Optional(Nullable(CreditCardBrand)),
    "creditCardToken": Type.Optional(Nullable(Type.String({ description: "Credit card token if tokenization is active.", examples: [null] }))),
  })
export type PaymentSaveWithCreditCardCreditCard = (typeof PaymentSaveWithCreditCardCreditCard)['static']

/** Interest information for payment after due date */
export const PaymentInterestResponse = Type.Object({
    "value": Type.Optional(Nullable(Type.Number({ description: "Interest value in percentage", examples: [2] }))),
  })
export type PaymentInterestResponse = (typeof PaymentInterestResponse)['static']

/** Refunded Splits, if any */
export const PaymentRefundedSplitResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique split identifier", examples: ["cff860dd-148e-48ca-ac8e-849684175158"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Refunded value", examples: [10] }))),
    "done": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the split was refunded", examples: [true] }))),
  })
export type PaymentRefundedSplitResponse = (typeof PaymentRefundedSplitResponse)['static']

/** Refunds information */
export const PaymentRefundGetResponse = Type.Object({
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Refund creation date", examples: ["2024-10-18 10:19:06"] }))),
    "status": Type.Optional(Nullable(PaymentRefundStatus)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Refund value", examples: [40] }))),
    "endToEndIdentifier": Type.Optional(Nullable(Type.String({ description: "(Pix only) Unique identifier of the Pix transaction at the Central Bank", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the refund", examples: [null] }))),
    "effectiveDate": Type.Optional(Nullable(Type.String({ description: "(Pix only) Refund effective date", examples: ["2024-10-19 10:19:06"] }))),
    "transactionReceiptUrl": Type.Optional(Nullable(Type.String({ description: "Transaction receipt link", examples: [null] }))),
    "refundedSplits": Type.Optional(Nullable(Type.Array(PaymentRefundedSplitResponse))),
  })
export type PaymentRefundGetResponse = (typeof PaymentRefundGetResponse)['static']

export const PaymentGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["payment"] }))),
    "id": Type.Optional(Nullable(Type.String({ description: "Unique payment identifier in Asaas", examples: ["pay_080225913252"] }))),
    "dateCreated": Type.Optional(Nullable(Type.String({ description: "Payment creation date", examples: ["2017-03-10"] }))),
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the customer to whom the payment belongs", examples: ["cus_G7Dvo4iphUNk"] }))),
    "subscription": Type.Optional(Nullable(Type.String({ description: "Unique subscription identifier (when recurring billing)", examples: [null] }))),
    "installment": Type.Optional(Nullable(Type.String({ description: "Unique installment identifier (when billing in installments)", examples: [null] }))),
    "checkoutSession": Type.Optional(Nullable(Type.String({ description: "Unique checkout identifier", examples: ["356eb0c4-9eb7-4b7f-b2be-d9479af1d29f"] }))),
    "paymentLink": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payments link to which the payment belongs", examples: [null] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Payment amount", examples: [129.9] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net value of the charge after discounting the Asaas fee", examples: [124.9] }))),
    "originalValue": Type.Optional(Nullable(Type.Number({ description: "Original amount of charge (filled when paid with interest and fine)", examples: [null] }))),
    "interestValue": Type.Optional(Nullable(Type.Number({ description: "Calculated amount of interest and fine that must be paid after the charge is due", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the payment", examples: ["Pedido 056984"] }))),
    "billingType": Type.Optional(Nullable(PaymentGetResponseBillingType)),
    "creditCard": Type.Optional(Nullable(PaymentSaveWithCreditCardCreditCard)),
    "canBePaidAfterDueDate": Type.Optional(Nullable(Type.Boolean({ description: "Informs whether the charge can be paid after the due date (Only for bank slip)", examples: [true] }))),
    "pixTransaction": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the Pix transaction to which the payment belongs", examples: [null] }))),
    "pixQrCodeId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the static QrCode generated for a given Pix key", examples: [null] }))),
    "status": Type.Optional(Nullable(PaymentStatus)),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Payment due date", examples: ["2017-06-10"] }))),
    "originalDueDate": Type.Optional(Nullable(Type.String({ description: "Original due date upon creation of the payment", examples: ["2017-06-10"] }))),
    "paymentDate": Type.Optional(Nullable(Type.String({ description: "Payment date on Asaas", examples: [null] }))),
    "clientPaymentDate": Type.Optional(Nullable(Type.String({ description: "Date on which the customer paid the bank slip", examples: [null] }))),
    "installmentNumber": Type.Optional(Nullable(Type.Integer({ description: "Parcel number", examples: [null] }))),
    "invoiceUrl": Type.Optional(Nullable(Type.String({ description: "Invoice URL", examples: ["https://www.asaas.com/i/080225913252"] }))),
    "invoiceNumber": Type.Optional(Nullable(Type.String({ description: "Bill number", examples: ["00005101"] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field", examples: ["056984"] }))),
    "deleted": Type.Optional(Nullable(Type.Boolean({ description: "Determines if the payment has been removed", examples: [false] }))),
    "anticipated": Type.Optional(Nullable(Type.Boolean({ description: "Defines whether the charge was anticipated or is in the process of being anticipated", examples: [false] }))),
    "anticipable": Type.Optional(Nullable(Type.Boolean({ description: "Determines whether the charge is anticipated", examples: [false] }))),
    "creditDate": Type.Optional(Nullable(Type.String({ description: "Date when the credit became available", examples: ["2017-06-10"] }))),
    "estimatedCreditDate": Type.Optional(Nullable(Type.String({ description: "Estimated date when the credit will be available", examples: ["2017-06-10"] }))),
    "transactionReceiptUrl": Type.Optional(Nullable(Type.String({ description: "URL of proof of confirmation, receipt, reversal or removal", examples: [null] }))),
    "nossoNumero": Type.Optional(Nullable(Type.String({ description: "Unique identification of the bank slip", examples: ["6453"] }))),
    "bankSlipUrl": Type.Optional(Nullable(Type.String({ description: "URL to download the bank slip", examples: ["https://www.asaas.com/b/pdf/080225913252"] }))),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "fine": Type.Optional(Nullable(PaymentFineResponse)),
    "interest": Type.Optional(Nullable(PaymentInterestResponse)),
    "split": Type.Optional(Nullable(Type.Array(LeanPaymentSplitGetResponse))),
    "postalService": Type.Optional(Nullable(Type.Boolean({ description: "Define whether the payment will be sent via post", examples: [false] }))),
    "daysAfterDueDateToRegistrationCancellation": Type.Optional(Nullable(Type.Integer({ description: "Days after registration cancellation deadline (only for bank slip)", examples: [null] }))),
    "chargeback": Type.Optional(Nullable(PaymentChargebackResponse)),
    "escrow": Type.Optional(Nullable(PaymentEscrowGetResponse)),
    "refunds": Type.Optional(Nullable(Type.Array(PaymentRefundGetResponse))),
  })
export type PaymentGetResponse = (typeof PaymentGetResponse)['static']

/** Interest information for payment after due date */
export const PaymentInterestRequest = Type.Object({
    "value": Type.Optional(Nullable(Type.Number({ description: "Percentage of interest per month on the amount charged for payment after maturity", examples: [null] }))),
  })
export type PaymentInterestRequest = (typeof PaymentInterestRequest)['static']

export const PaymentListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentGetResponse))),
  })
export type PaymentListResponse = (typeof PaymentListResponse)['static']

export const PaymentPathIdRequest = Type.Object({})
export type PaymentPathIdRequest = (typeof PaymentPathIdRequest)['static']

export const PaymentReceiveInCashRequest = Type.Object({
    "paymentDate": Type.Optional(Nullable(Type.String({ description: "Date the customer made the payment", examples: ["2025-05-30"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Amount paid by the customer", examples: [129.9] }))),
    "notifyCustomer": Type.Optional(Nullable(Type.Boolean({ description: "Send or not send notification of confirmed payment to the customer", examples: [false] }))),
  })
export type PaymentReceiveInCashRequest = (typeof PaymentReceiveInCashRequest)['static']

/** Split refunds */
export const PaymentRefundSplitRequest = Type.Object({
    "id": Type.String({ description: "Unique identification of the split in Asaas", examples: ["6fba235c-3726-4e32-b4e6-85f46e10cc2e"] }),
    "value": Type.Number({ description: "Amount to be refunded from split", examples: [2.5] }),
  })
export type PaymentRefundSplitRequest = (typeof PaymentRefundSplitRequest)['static']

export const PaymentRefundRequest = Type.Object({
    "value": Type.Optional(Nullable(Type.Number({ description: "Total amount to be refunded", examples: [5] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Reason for the refund", examples: ["Valor a mais"] }))),
    "splitRefunds": Type.Optional(Nullable(Type.Array(PaymentRefundSplitRequest))),
  })
export type PaymentRefundRequest = (typeof PaymentRefundRequest)['static']

/** Split Settings */
export const PaymentSplitRequest = Type.Object({
    "walletId": Type.String({ description: "Asaas wallet identifier that will be transferred", examples: [null] }),
    "fixedValue": Type.Optional(Nullable(Type.Number({ description: "Fixed amount to be transferred to the account when the payment is received", examples: [null] }))),
    "percentualValue": Type.Optional(Nullable(Type.Number({ description: "Percentage of the net value of the charge to be transferred when received", examples: [null] }))),
    "totalFixedValue": Type.Optional(Nullable(Type.Number({ description: "(Instalments only). Amount that will be split relative to the total amount that will be paid in installments.", examples: [null] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Split identifier in your system", examples: [null] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Split description", examples: [null] }))),
  })
export type PaymentSplitRequest = (typeof PaymentSplitRequest)['static']

export const PaymentSaveRequest = Type.Object({
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier in Asaas", examples: ["cus_G7Dvo4iphUNk"] }))),
    "billingType": Type.Optional(Nullable(BillingType)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Payment amount", examples: [129.9] }))),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Payment due date", examples: ["2017-06-10"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Payment description (max. 500 characters)", examples: ["Pedido 056984"] }))),
    "daysAfterDueDateToRegistrationCancellation": Type.Optional(Nullable(Type.Integer({ description: "Days after registration cancellation deadline (only for bank slip)", examples: [1] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field", examples: ["056984"] }))),
    "installmentCount": Type.Optional(Nullable(Type.Integer({ description: "Number of installments (only in the case of installment payment)", examples: [null] }))),
    "totalValue": Type.Optional(Nullable(Type.Number({ description: "Enter the total amount of a charge that will be paid in installments (only in the case of an installment charge). If this field is sent, the installmentValue is not necessary, the calculation per installment will be automatic.", examples: [null] }))),
    "installmentValue": Type.Optional(Nullable(Type.Number({ description: "Value of each installment (only in the case of installment payment). Send this field if you want to define the value of each installment.", examples: [null] }))),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "interest": Type.Optional(Nullable(PaymentInterestRequest)),
    "fine": Type.Optional(Nullable(PaymentFineRequest)),
    "postalService": Type.Optional(Nullable(Type.Boolean({ description: "Define whether the payment will be sent via post", examples: [false] }))),
    "split": Type.Optional(Nullable(Type.Array(PaymentSplitRequest))),
    "callback": Type.Optional(Nullable(PaymentCallbackRequest)),
    "pixAutomaticAuthorizationId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the Pix Automatic authorization in Asaas", examples: ["89060430-aceb-447c-a981-07ee15daf00c"] }))),
  })
export type PaymentSaveRequest = (typeof PaymentSaveRequest)['static']

export const PaymentSaveWithCreditCardRequest = Type.Object({
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier in Asaas", examples: ["cus_G7Dvo4iphUNk"] }))),
    "billingType": Type.Optional(Nullable(BillingType)),
    "value": Type.Optional(Nullable(Type.Number({ description: "Payment amount", examples: [129.9] }))),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Payment due date", examples: ["2017-06-10"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Payment description (max. 500 characters)", examples: ["Pedido 056984"] }))),
    "daysAfterDueDateToRegistrationCancellation": Type.Optional(Nullable(Type.Integer({ description: "Days after registration cancellation deadline (only for bank slip)", examples: [1] }))),
    "externalReference": Type.Optional(Nullable(Type.String({ description: "Free search field", examples: ["056984"] }))),
    "installmentCount": Type.Optional(Nullable(Type.Integer({ description: "Number of installments (only in the case of installment payment)", examples: [null] }))),
    "totalValue": Type.Optional(Nullable(Type.Number({ description: "Enter the total amount of a charge that will be paid in installments (only in the case of an installment charge). If this field is sent, the installmentValue is not necessary, the calculation per installment will be automatic.", examples: [null] }))),
    "installmentValue": Type.Optional(Nullable(Type.Number({ description: "Value of each installment (only in the case of installment payment). Send this field if you want to define the value of each installment.", examples: [null] }))),
    "discount": Type.Optional(Nullable(PaymentDiscount)),
    "interest": Type.Optional(Nullable(PaymentInterestRequest)),
    "fine": Type.Optional(Nullable(PaymentFineRequest)),
    "postalService": Type.Optional(Nullable(Type.Boolean({ description: "Define whether the payment will be sent via post", examples: [false] }))),
    "split": Type.Optional(Nullable(Type.Array(PaymentSplitRequest))),
    "callback": Type.Optional(Nullable(PaymentCallbackRequest)),
    "pixAutomaticAuthorizationId": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the Pix Automatic authorization in Asaas", examples: ["89060430-aceb-447c-a981-07ee15daf00c"] }))),
    "creditCard": Type.Optional(Nullable(CreditCardRequest)),
    "creditCardHolderInfo": Type.Optional(Nullable(CreditCardHolderInfoRequest)),
    "creditCardToken": Type.Optional(Nullable(Type.String({ description: "Credit card token for using the credit card tokenization functionality", examples: [null] }))),
    "authorizeOnly": Type.Optional(Nullable(Type.Boolean({ description: "Carry out only the Pre-Authorization of the payment", examples: [null] }))),
    "remoteIp": Type.Optional(Nullable(Type.String({ description: "IP from where the customer is making the purchase. Your server's IP must not be entered.", examples: [null] }))),
  })
export type PaymentSaveWithCreditCardRequest = (typeof PaymentSaveWithCreditCardRequest)['static']

/** Array with desired Webhooks settings */
export const WebhookConfigSaveRequest = Type.Object({
    "name": Type.String({ description: "Webhook name", examples: ["Name Example"] }),
    "url": Type.String({ description: "Webhook URL", examples: ["https://www.example.com/webhook/asaas"] }),
    "email": Type.String({ description: "Email that will receive notifications about the Webhook", examples: ["john.doe@asaas.com.br"] }),
    "enabled": Type.Optional(Nullable(Type.Boolean({ description: "Set whether the Webhook is active", examples: [true] }))),
    "interrupted": Type.Optional(Nullable(Type.Boolean({ description: "Set whether the sync queue is stopped", examples: [false] }))),
    "apiVersion": Type.Optional(Nullable(Type.Integer({ description: "API Version", examples: [3] }))),
    "authToken": Type.Optional(Nullable(Type.String({ description: "Webhook authentication token", examples: ["whsec_Pxeh17yy3LQbLVpnzz6I1chB7mtzYk5F7pg8bRR80pE"] }))),
    "sendType": WebhookSendType,
    "events": Type.Array(WebhookEvent),
  })
export type WebhookConfigSaveRequest = (typeof WebhookConfigSaveRequest)['static']
