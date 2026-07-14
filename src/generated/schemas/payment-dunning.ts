// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { DataPaymentDunningHistoryStatus, FinanceGetPaymentStatisticsRequestBillingType, FinanceGetPaymentStatisticsRequestPaymentStatus, PaymentDunningStatus, PaymentDunningType } from '../enums.ts'

export const PaymentDunningCancelRequest = Type.Object({})
export type PaymentDunningCancelRequest = (typeof PaymentDunningCancelRequest)['static']

export const PaymentDunningCancelResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment dunning in Asaas", examples: ["ce35702d-0d9f-475a-ba46-e251ad265c91"] }))),
    "dunningNumber": Type.Optional(Nullable(Type.Integer({ description: "Payment dunning number", examples: [15] }))),
    "status": Type.Optional(Nullable(PaymentDunningStatus)),
    "type": Type.Optional(Nullable(PaymentDunningType)),
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment to be recovered in Asaas", examples: ["pay_080225913252"] }))),
    "requestDate": Type.Optional(Nullable(Type.String({ description: "Request date", examples: ["2020-05-26"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the payment dunning", examples: ["Duas mesas com 8 cadeiras solicitadas via encomenda no dia 01/05/2018"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Payment amount", examples: [80] }))),
    "feeValue": Type.Optional(Nullable(Type.Number({ description: "Cost and/or payment dunning fee", examples: [8] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net amount to be recovered", examples: [72] }))),
    "receivedInCashFeeValue": Type.Optional(Nullable(Type.Number({ description: "Cash receipt fee", examples: [0] }))),
    "denialReason": Type.Optional(Nullable(Type.String({ description: "Reason for denial of payment dunning", examples: [null] }))),
    "cancellationFeeValue": Type.Optional(Nullable(Type.Number({ description: "Fee charged in case of cancellation", examples: [0] }))),
    "canBeCancelled": Type.Optional(Nullable(Type.Boolean({ description: "Whether the payment dunning can be canceled", examples: [null] }))),
    "cannotBeCancelledReason": Type.Optional(Nullable(Type.String({ description: "Reason for not being able to request cancellation", examples: [null] }))),
    "isNecessaryResendDocumentation": Type.Optional(Nullable(Type.Boolean({ description: "Determine whether documentation needs to be resubmitted", examples: [null] }))),
  })
export type PaymentDunningCancelResponse = (typeof PaymentDunningCancelResponse)['static']

/** List of objects */
export const PaymentDunningListHistoryResponseData = Type.Object({
    "status": Type.Optional(Nullable(DataPaymentDunningHistoryStatus)),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the event", examples: ["Negativação negociada com o cliente. O pagamento será iniciado."] }))),
    "eventDate": Type.Optional(Nullable(Type.String({ description: "Date the event occurred", examples: ["2019-02-20"] }))),
  })
export type PaymentDunningListHistoryResponseData = (typeof PaymentDunningListHistoryResponseData)['static']

export const PaymentDunningListHistoryResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentDunningListHistoryResponseData))),
  })
export type PaymentDunningListHistoryResponse = (typeof PaymentDunningListHistoryResponse)['static']

/** List of objects */
export const PaymentDunningListPartialPaymentsResponseData = Type.Object({
    "value": Type.Optional(Nullable(Type.Number({ description: "Amount paid", examples: [800] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Payment Description", examples: ["A quitação desta cobrança foi efetuada pelo cliente."] }))),
    "paymentDate": Type.Optional(Nullable(Type.String({ description: "Pay day", examples: ["2020-02-10"] }))),
  })
export type PaymentDunningListPartialPaymentsResponseData = (typeof PaymentDunningListPartialPaymentsResponseData)['static']

export const PaymentDunningListPartialPaymentsResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentDunningListPartialPaymentsResponseData))),
  })
export type PaymentDunningListPartialPaymentsResponse = (typeof PaymentDunningListPartialPaymentsResponse)['static']

export const PaymentDunningShowResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment dunning in Asaas", examples: ["ce35702d-0d9f-475a-ba46-e251ad265c91"] }))),
    "dunningNumber": Type.Optional(Nullable(Type.Integer({ description: "Payment dunning number", examples: [15] }))),
    "status": Type.Optional(Nullable(PaymentDunningStatus)),
    "type": Type.Optional(Nullable(PaymentDunningType)),
    "requestDate": Type.Optional(Nullable(Type.String({ description: "Request date", examples: ["2020-05-26"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the payment dunning", examples: ["Duas mesas com 8 cadeiras solicitadas via encomenda no dia 01/05/2018"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Payment amount", examples: [80] }))),
    "feeValue": Type.Optional(Nullable(Type.Number({ description: "Cost and/or payment dunning fee", examples: [8] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net amount to be recovered", examples: [72] }))),
    "receivedInCashFeeValue": Type.Optional(Nullable(Type.Number({ description: "Cash receipt fee", examples: [0] }))),
    "denialReason": Type.Optional(Nullable(Type.String({ description: "Reason for denial of payment dunning", examples: [null] }))),
    "cancellationFeeValue": Type.Optional(Nullable(Type.Number({ description: "Fee charged in case of cancellation", examples: [0] }))),
    "canBeCancelled": Type.Optional(Nullable(Type.Boolean({ description: "Whether the payment dunning can be canceled", examples: [null] }))),
    "cannotBeCancelledReason": Type.Optional(Nullable(Type.String({ description: "Reason for not being able to request cancellation", examples: [null] }))),
    "isNecessaryResendDocumentation": Type.Optional(Nullable(Type.Boolean({ description: "Determine whether documentation needs to be resubmitted", examples: [null] }))),
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment to be recovered in Asaas", examples: ["pay_080225913252"] }))),
  })
export type PaymentDunningShowResponse = (typeof PaymentDunningShowResponse)['static']

export const PaymentDunningListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentDunningShowResponse))),
  })
export type PaymentDunningListResponse = (typeof PaymentDunningListResponse)['static']

/** Simulation of denial request for each type of payment dunning available */
export const PaymentDunningPaymentsAvailableForDunningResponseDataTypeSimulationItem = Type.Object({
    "type": Type.Optional(Nullable(PaymentDunningType)),
    "isAllowed": Type.Optional(Nullable(Type.Boolean({ description: "Whether it is possible to request a payment dunning of this type", examples: [null] }))),
    "notAllowedReason": Type.Optional(Nullable(Type.String({ description: "Reason why it is not possible to request a payment dunning for this type", examples: [null] }))),
    "feeValue": Type.Optional(Nullable(Type.Number({ description: "Cost and/or payment dunning fee", examples: [0] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net amount to be recovered", examples: [0] }))),
    "startDate": Type.Optional(Nullable(Type.String({ description: "Expected start date of the payment dunning", examples: ["2020-05-27"] }))),
  })
export type PaymentDunningPaymentsAvailableForDunningResponseDataTypeSimulationItem = (typeof PaymentDunningPaymentsAvailableForDunningResponseDataTypeSimulationItem)['static']

/** List of objects */
export const PaymentDunningPaymentsAvailableForDunningResponseData = Type.Object({
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment to be recovered in Asaas", examples: ["pay_856437540297"] }))),
    "customer": Type.Optional(Nullable(Type.String({ description: "Unique customer identifier", examples: ["cus_000000001663"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Payment amount", examples: [250] }))),
    "status": Type.Optional(Nullable(FinanceGetPaymentStatisticsRequestPaymentStatus)),
    "billingType": Type.Optional(Nullable(FinanceGetPaymentStatisticsRequestBillingType)),
    "dueDate": Type.Optional(Nullable(Type.String({ description: "Due date", examples: ["2020-05-18"] }))),
    "typeSimulations": Type.Optional(Nullable(Type.Array(PaymentDunningPaymentsAvailableForDunningResponseDataTypeSimulationItem))),
  })
export type PaymentDunningPaymentsAvailableForDunningResponseData = (typeof PaymentDunningPaymentsAvailableForDunningResponseData)['static']

export const PaymentDunningPaymentsAvailableForDunningResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(PaymentDunningPaymentsAvailableForDunningResponseData))),
  })
export type PaymentDunningPaymentsAvailableForDunningResponse = (typeof PaymentDunningPaymentsAvailableForDunningResponse)['static']

export const PaymentDunningSaveDocumentsRequest = Type.Object({
    "documents": Type.Any(),
  })
export type PaymentDunningSaveDocumentsRequest = (typeof PaymentDunningSaveDocumentsRequest)['static']

export const PaymentDunningSaveDocumentsResponse = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment dunning in Asaas", examples: ["ce35702d-0d9f-475a-ba46-e251ad265c91"] }))),
    "dunningNumber": Type.Optional(Nullable(Type.Integer({ description: "Payment dunning number", examples: [15] }))),
    "status": Type.Optional(Nullable(PaymentDunningStatus)),
    "type": Type.Optional(Nullable(PaymentDunningType)),
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment to be recovered in Asaas", examples: ["pay_080225913252"] }))),
    "requestDate": Type.Optional(Nullable(Type.String({ description: "Request date", examples: ["2020-05-26"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the payment dunning", examples: ["Duas mesas com 8 cadeiras solicitadas via encomenda no dia 01/05/2018"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Payment amount", examples: [80] }))),
    "feeValue": Type.Optional(Nullable(Type.Number({ description: "Cost and/or payment dunning fee", examples: [8] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net amount to be recovered", examples: [72] }))),
    "receivedInCashFeeValue": Type.Optional(Nullable(Type.Number({ description: "Cash receipt fee", examples: [0] }))),
    "denialReason": Type.Optional(Nullable(Type.String({ description: "Reason for denial of payment dunning", examples: [null] }))),
    "cancellationFeeValue": Type.Optional(Nullable(Type.Number({ description: "Fee charged in case of cancellation", examples: [0] }))),
    "canBeCancelled": Type.Optional(Nullable(Type.Boolean({ description: "Whether the payment dunning can be canceled", examples: [null] }))),
    "cannotBeCancelledReason": Type.Optional(Nullable(Type.String({ description: "Reason for not being able to request cancellation", examples: [null] }))),
    "isNecessaryResendDocumentation": Type.Optional(Nullable(Type.Boolean({ description: "Determine whether documentation needs to be resubmitted", examples: [null] }))),
  })
export type PaymentDunningSaveDocumentsResponse = (typeof PaymentDunningSaveDocumentsResponse)['static']

export const PaymentDunningSaveRequest = Type.Object({
    "payment": Type.String({ description: "Unique identifier of the payment to be recovered in Asaas", examples: ["pay_080225913252"] }),
    "type": PaymentDunningType,
    "description": Type.Optional(Nullable(Type.String({ description: "Description of the product or service provided", examples: ["Duas mesas com 8 cadeiras solicitadas via encomenda no dia 01/05/2018"] }))),
    "customerName": Type.String({ description: "Client name", examples: ["John Doe"] }),
    "customerCpfCnpj": Type.String({ description: "Customer CPF or CNPJ", examples: ["378.285.120-07"] }),
    "customerPrimaryPhone": Type.String({ description: "Customer main telephone number", examples: ["(11) 99999-9999"] }),
    "customerSecondaryPhone": Type.Optional(Nullable(Type.String({ description: "Secondary customer phone number", examples: ["(11) 99999-9999"] }))),
    "customerPostalCode": Type.String({ description: "Customer address zip code", examples: ["99050-460"] }),
    "customerAddress": Type.String({ description: "Customer public address", examples: ["Rua Izaías Fontana"] }),
    "customerAddressNumber": Type.String({ description: "Customer address number", examples: ["123"] }),
    "customerComplement": Type.Optional(Nullable(Type.String({ description: "Customer address complement", examples: ["AP 101"] }))),
    "customerProvince": Type.String({ description: "Customer neighborhood", examples: ["Petrópolis"] }),
    "documents": Type.Optional(Nullable(Type.Any())),
  })
export type PaymentDunningSaveRequest = (typeof PaymentDunningSaveRequest)['static']

export const PaymentDunningSimulateRequest = Type.Object({})
export type PaymentDunningSimulateRequest = (typeof PaymentDunningSimulateRequest)['static']

/** Simulation of denial request for each type of denial available */
export const PaymentDunningSimulateResponseTypeSimulationItem = Type.Object({
    "type": Type.Optional(Nullable(PaymentDunningType)),
    "isAllowed": Type.Optional(Nullable(Type.Boolean({ description: "Whether it is possible to request a payment dunning of this type", examples: [null] }))),
    "notAllowedReason": Type.Optional(Nullable(Type.String({ description: "Reason why it is not possible to request a payment dunning for this type", examples: ["A negativação via Serasa não está disponível para parcelamentos de cartão de crédito."] }))),
    "feeValue": Type.Optional(Nullable(Type.Number({ description: "Cost and/or payment dunning fee", examples: [0] }))),
    "netValue": Type.Optional(Nullable(Type.Number({ description: "Net amount to be recovered", examples: [0] }))),
    "startDate": Type.Optional(Nullable(Type.String({ description: "Expected start date of the payment dunning", examples: [null] }))),
  })
export type PaymentDunningSimulateResponseTypeSimulationItem = (typeof PaymentDunningSimulateResponseTypeSimulationItem)['static']

export const PaymentDunningSimulateResponse = Type.Object({
    "payment": Type.Optional(Nullable(Type.String({ description: "Unique identifier of the payment to be recovered in Asaas", examples: ["pay_080225913252"] }))),
    "value": Type.Optional(Nullable(Type.Number({ description: "Payment amount", examples: [80] }))),
    "typeSimulations": Type.Optional(Nullable(Type.Array(PaymentDunningSimulateResponseTypeSimulationItem))),
  })
export type PaymentDunningSimulateResponse = (typeof PaymentDunningSimulateResponse)['static']
