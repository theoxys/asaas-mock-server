// GERADO POR "bun run codegen" — NÃO EDITE À MÃO.
// Fonte: spec/openapi.json + spec/overlays/*.json

import { Type } from '@sinclair/typebox'
import { Nullable } from '../nullable.ts'
import { EnotasTipoAutenticacao } from '../enums.ts'
import { File } from './common.ts'

/** List of objects */
export const FiscalInfoFederalServiceCodeResponse = Type.Object({
    "code": Type.Optional(Nullable(Type.String({ description: "Tax code", examples: ["040801"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description", examples: ["Occupational therapy"] }))),
  })
export type FiscalInfoFederalServiceCodeResponse = (typeof FiscalInfoFederalServiceCodeResponse)['static']

export const FiscalInfoFederalServiceCodeListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(FiscalInfoFederalServiceCodeResponse))),
  })
export type FiscalInfoFederalServiceCodeListResponse = (typeof FiscalInfoFederalServiceCodeListResponse)['static']

export const FiscalInfoGetResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["customerFiscalInfo"] }))),
    "email": Type.Optional(Nullable(Type.String({ description: "Email used by Asaas to send invoice notifications and alerts", examples: ["john.doe@asaas.com.br"] }))),
    "municipalInscription": Type.Optional(Nullable(Type.String({ description: "Company municipal registration", examples: ["21779501"] }))),
    "simplesNacional": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the company opts for the simple national system", examples: [false] }))),
    "culturalProjectsPromoter": Type.Optional(Nullable(Type.Boolean({ description: "Identifies whether the company is classified as a cultural promoter", examples: [false] }))),
    "cnae": Type.Optional(Nullable(Type.String({ description: "CNAE code", examples: ["6209100"] }))),
    "specialTaxRegime": Type.Optional(Nullable(Type.String({ description: "Special taxation regime identifier", examples: ["1"] }))),
    "serviceListItem": Type.Optional(Nullable(Type.String({ description: "Service list item, as http://www.planalto.gov.br/ccivil_03/leis/LCP/Lcp116.htm", examples: [null] }))),
    "nbsCode": Type.Optional(Nullable(Type.String({ description: "NBS Code (Brazilian Nomenclature of Services). It must be included on the NFS-e (Electronic Service Invoice) when required by the municipal government and/or for import or export services. Check with your local government or your accounting department to determine whether this information is necessary.", examples: ["1.0101"] }))),
    "rpsSerie": Type.Optional(Nullable(Type.String({ description: "Serial Number registered for the company", examples: ["1"] }))),
    "rpsNumber": Type.Optional(Nullable(Type.Integer({ description: "RPS number used in the last invoice issued to your company", examples: [1] }))),
    "loteNumber": Type.Optional(Nullable(Type.Integer({ description: "Batch number used on the last invoice issued by your company", examples: [1] }))),
    "username": Type.Optional(Nullable(Type.String({ description: "User to access your city's city hall website", examples: ["johndoe"] }))),
    "passwordSent": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the password to access the city hall website has been entered", examples: [true] }))),
    "accessTokenSent": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the token for accessing the city hall website was provided", examples: [true] }))),
    "certificateSent": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether the digital certificate for access to the city hall website has been provided", examples: [true] }))),
    "nationalPortalTaxCalculationRegime": Type.Optional(Nullable(Type.String({ description: "Identifier of the tax calculation regime", examples: [null] }))),
  })
export type FiscalInfoGetResponse = (typeof FiscalInfoGetResponse)['static']

/** List of objects */
export const FiscalInfoListInvoiceNbsCodesResponseData = Type.Object({
    "nbsCode": Type.Optional(Nullable(Type.String({ description: "NBS code (Brazilian Nomenclature of Services)", examples: ["1.0101.11.00"] }))),
    "codeDescription": Type.Optional(Nullable(Type.String({ description: "NBS code and description", examples: ["1.0101.11.00 - Construction services for one- and two-story residential buildings"] }))),
  })
export type FiscalInfoListInvoiceNbsCodesResponseData = (typeof FiscalInfoListInvoiceNbsCodesResponseData)['static']

export const FiscalInfoListInvoiceNbsCodesResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(FiscalInfoListInvoiceNbsCodesResponseData))),
  })
export type FiscalInfoListInvoiceNbsCodesResponse = (typeof FiscalInfoListInvoiceNbsCodesResponse)['static']

/** List of objects */
export const FiscalInfoListMunicipalServicesResponseData = Type.Object({
    "id": Type.Optional(Nullable(Type.String({ description: "Unique service identifier", examples: ["3544"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Service description", examples: ["1.01 - Análise e desenvolvimento de sistemas"] }))),
    "issTax": Type.Optional(Nullable(Type.Number({ description: "ISS percentage rate", examples: [0.5] }))),
  })
export type FiscalInfoListMunicipalServicesResponseData = (typeof FiscalInfoListMunicipalServicesResponseData)['static']

export const FiscalInfoListMunicipalServicesResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(FiscalInfoListMunicipalServicesResponseData))),
  })
export type FiscalInfoListMunicipalServicesResponse = (typeof FiscalInfoListMunicipalServicesResponse)['static']

/** Tax calculation regime options */
export const FiscalInfoMunicipalOptionsSpecialTaxRegimes = Type.Object({
    "label": Type.Optional(Nullable(Type.String({ description: "Name of the special taxation regime", examples: ["Municipal Micro enterprise"] }))),
    "value": Type.Optional(Nullable(Type.String({ description: "Special taxation regime identifier", examples: ["1"] }))),
  })
export type FiscalInfoMunicipalOptionsSpecialTaxRegimes = (typeof FiscalInfoMunicipalOptionsSpecialTaxRegimes)['static']

/** Special taxation regime options */
export const FiscalInfoMunicipalOptionsNationalPortalTaxCalculationRegime = Type.Object({
    "label": Type.Optional(Nullable(Type.String({ description: "Name of the tax calculation regime", examples: ["Regime for calculating federal and municipal taxes by the SN"] }))),
    "value": Type.Optional(Nullable(Type.String({ description: "Identifier of the tax calculation regime", examples: ["0"] }))),
  })
export type FiscalInfoMunicipalOptionsNationalPortalTaxCalculationRegime = (typeof FiscalInfoMunicipalOptionsNationalPortalTaxCalculationRegime)['static']

export const FiscalInfoMunicipalOptionsGetResponse = Type.Object({
    "authenticationType": Type.Optional(Nullable(EnotasTipoAutenticacao)),
    "supportsCancellation": Type.Optional(Nullable(Type.Boolean({ description: "Whether or not it supports the cancellation of invoices automatically at your city hall", examples: [true] }))),
    "usesSpecialTaxRegimes": Type.Optional(Nullable(Type.Boolean({ description: "It is necessary to inform or not the special taxation regime. If used, enter it in the `specialTaxRegime` field of **Create or update tax information** according to the options returned in the `specialTaxRegimesList` list.", examples: [true] }))),
    "usesServiceListItem": Type.Optional(Nullable(Type.Boolean({ description: "Whether or not to inform the item on the service list", examples: [true] }))),
    "specialTaxRegimesList": Type.Optional(Nullable(Type.Array(FiscalInfoMunicipalOptionsSpecialTaxRegimes))),
    "nationalPortalTaxCalculationRegimeList": Type.Optional(Nullable(Type.Array(FiscalInfoMunicipalOptionsNationalPortalTaxCalculationRegime))),
    "nationalPortalTaxCalculationRegimeHelp": Type.Optional(Nullable(Type.String({ description: "Explanation of the tax calculation regime", examples: ["This identifies your company's tax calculation regime. If you wish to leave no option selected, select the \"None\" option. It must only be completed by companies classified as ME or EPP opting for Simples Nacional. Consult the need for this information with your city hall or accounting department."] }))),
    "municipalInscriptionHelp": Type.Optional(Nullable(Type.String({ description: "Explanation of the municipal registration format", examples: ["Only enter numbers without periods or formatting (if they contain letters, always enter them in capital letters).\r\n\r\nValid examples: 4301000010 or 131436001X"] }))),
    "specialTaxRegimeHelp": Type.Optional(Nullable(Type.String({ description: "Explanation of the special taxation regime", examples: ["This identifies your company's taxation regime, if you wish to leave no option marked, select the dash (\"-\").\r\n \r\n Simple national companies generally opt for ME or ME EPP"] }))),
    "serviceListItemHelp": Type.Optional(Nullable(Type.String({ description: "Explanation of service list item format", examples: ["Enter the service list item here, it is also an identifier of the service provided.\r\n \r\n You need to complete the service list item maintaining the formatting.\r\n Valid examples: 17.02 or 8.02"] }))),
    "digitalCertificatedHelp": Type.Optional(Nullable(Type.String({ description: "Explanation of digital certificate", examples: ["Your city hall requires the use of a digital certificate, so include your A1 certificate file here."] }))),
    "accessTokenHelp": Type.Optional(Nullable(Type.String({ description: "Token Explanation", examples: [null] }))),
    "municipalServiceCodeHelp": Type.Optional(Nullable(Type.String({ description: "Explanation of municipal service code format", examples: ["Enter here the municipal code that identifies the service provided on the invoice.\r\nIn some cities this code is known as the taxation code or CTISS.\r\n\r\nValid example: 010300388"] }))),
  })
export type FiscalInfoMunicipalOptionsGetResponse = (typeof FiscalInfoMunicipalOptionsGetResponse)['static']

/** List of objects */
export const FiscalInfoOperationIndicatorCodeResponse = Type.Object({
    "code": Type.Optional(Nullable(Type.String({ description: "Operation indicator code", examples: ["020101"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description", examples: ["Execution of transactions involving real estate, intangible assets, including rights related to real estate."] }))),
  })
export type FiscalInfoOperationIndicatorCodeResponse = (typeof FiscalInfoOperationIndicatorCodeResponse)['static']

export const FiscalInfoOperationIndicatorCodeListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(FiscalInfoOperationIndicatorCodeResponse))),
  })
export type FiscalInfoOperationIndicatorCodeListResponse = (typeof FiscalInfoOperationIndicatorCodeListResponse)['static']

export const FiscalInfoSaveRequest = Type.Object({
    "email": Type.String({ description: "Email used by Asaas to send invoice notifications and alerts", examples: ["john.doe@asaas.com.br"] }),
    "municipalInscription": Type.Optional(Nullable(Type.String({ description: "Company municipal registration", examples: ["21779501"] }))),
    "simplesNacional": Type.Boolean({ description: "Indicates whether the company opts for the simple national system", examples: [false] }),
    "culturalProjectsPromoter": Type.Optional(Nullable(Type.Boolean({ description: "Identifies whether the company is classified as a cultural promoter", examples: [false] }))),
    "cnae": Type.Optional(Nullable(Type.String({ description: "CNAE code", examples: ["6209100"] }))),
    "specialTaxRegime": Type.Optional(Nullable(Type.String({ description: "Special taxation regime identifier", examples: ["1"] }))),
    "serviceListItem": Type.Optional(Nullable(Type.String({ description: "Service list item, as http://www.planalto.gov.br/ccivil_03/leis/LCP/Lcp116.htm", examples: [null] }))),
    "nbsCode": Type.Optional(Nullable(Type.String({ description: "NBS Code (Brazilian Nomenclature of Services). It must be included on the NFS-e (Electronic Service Invoice) when required by the municipal government and/or for import or export services. Check with your local government or your accounting department to determine whether this information is necessary.", examples: ["1.0101"] }))),
    "rpsSerie": Type.Optional(Nullable(Type.String({ description: "Serial Number used by your company to issue invoices. For NFSe on the national standard, the series must follow the authentication method: Digital certificate (00001 to 49999) or Username and password (80000 to 89999). For municipal issuance, in most cities the serial number used is '1' or 'E'", examples: ["1"] }))),
    "rpsNumber": Type.Optional(Nullable(Type.Integer({ description: "RPS number used on the last invoice issued by your company. If your last NF issued has an RPS equal to '100', this field must be filled in with '101'. If you have never issued invoices through your city hall's website, enter '1' in this field", examples: [1] }))),
    "loteNumber": Type.Optional(Nullable(Type.Integer({ description: "Batch number used on the last invoice issued by your company. If the last lot used in your city hall is '25', this field must be filled in with '26'. Only enter this field if your city hall requires the use of lots", examples: [1] }))),
    "username": Type.Optional(Nullable(Type.String({ description: "User to access your city's city hall website", examples: ["johndoe"] }))),
    "password": Type.Optional(Nullable(Type.String({ description: "Password to access the city hall website", examples: [null] }))),
    "accessToken": Type.Optional(Nullable(Type.String({ description: "Token for access to the city hall website (If access to your city hall website is via Token)", examples: [null] }))),
    "certificateFile": Type.Optional(Nullable(File)),
    "certificatePassword": Type.Optional(Nullable(Type.String({ description: "Password for the digital certificate sent (If access to your city hall website through a digital certificate)", examples: [null] }))),
    "nationalPortalTaxCalculationRegime": Type.Optional(Nullable(Type.String({ description: "Identifier of the tax calculation regime. It must only be completed by companies classified as ME or EPP opting for Simples Nacional. Consult the need for this information with your city hall or accounting department.", examples: [null] }))),
  })
export type FiscalInfoSaveRequest = (typeof FiscalInfoSaveRequest)['static']

/** List of objects */
export const FiscalInfoTaxSituationCodeResponse = Type.Object({
    "code": Type.Optional(Nullable(Type.String({ description: "Tax situation code", examples: ["200001"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description", examples: ["Taxation with reduced, uniform rates"] }))),
    "isSubjectToIbsCbsTaxation": Type.Optional(Nullable(Type.Boolean({ description: "Determines whether it is subject to IBS and CBS taxation", examples: [true] }))),
    "isBaseReductionPercentApplicable": Type.Optional(Nullable(Type.Boolean({ description: "Determines whether the percentage reduction of the base is applicable", examples: [false] }))),
    "isDefermentApplicable": Type.Optional(Nullable(Type.Boolean({ description: "Determines whether deferment applies", examples: [false] }))),
  })
export type FiscalInfoTaxSituationCodeResponse = (typeof FiscalInfoTaxSituationCodeResponse)['static']

/** List of objects */
export const FiscalInfoTaxClassificationCodeResponse = Type.Object({
    "code": Type.Optional(Nullable(Type.String({ description: "Tax classification code", examples: ["011001"] }))),
    "description": Type.Optional(Nullable(Type.String({ description: "Description", examples: ["Situations taxed in full by IBS and CBS"] }))),
    "effectiveStartDate": Type.Optional(Nullable(Type.String({ description: "Effective start date", examples: ["2026-01-01"] }))),
    "expirationDate": Type.Optional(Nullable(Type.String({ description: "Expiration date", examples: ["2030-01-01"] }))),
    "isSubjectRegularTaxation": Type.Optional(Nullable(Type.Boolean({ description: "Indicates if subject to regular taxation", examples: [false] }))),
    "cbsPercentage": Type.Optional(Nullable(Type.Number({ description: "CBS tax percentage", examples: [0.9] }))),
    "municipalIbsTaxPercentage": Type.Optional(Nullable(Type.Number({ description: "Municipal IBS tax percentage", examples: [0] }))),
    "stateIbsTaxPercentage": Type.Optional(Nullable(Type.Number({ description: "State IBS tax percentage", examples: [0.1] }))),
    "cbsTaxReductionPercentage": Type.Optional(Nullable(Type.Number({ description: "CBS reduction tax percentage", examples: [0] }))),
    "ibsTaxReductionPercentage": Type.Optional(Nullable(Type.Number({ description: "IBS reduction tax base percentage", examples: [0] }))),
    "taxRegimeType": Type.Optional(Nullable(Type.String({ description: "Tax regime type", examples: ["STANDARD"] }))),
    "taxSituation": Type.Optional(Nullable(FiscalInfoTaxSituationCodeResponse)),
  })
export type FiscalInfoTaxClassificationCodeResponse = (typeof FiscalInfoTaxClassificationCodeResponse)['static']

export const FiscalInfoTaxClassificationCodeListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(FiscalInfoTaxClassificationCodeResponse))),
  })
export type FiscalInfoTaxClassificationCodeListResponse = (typeof FiscalInfoTaxClassificationCodeListResponse)['static']

export const FiscalInfoTaxSituationCodeListResponse = Type.Object({
    "object": Type.Optional(Nullable(Type.String({ description: "Object type", examples: ["list"] }))),
    "hasMore": Type.Optional(Nullable(Type.Boolean({ description: "Indicates whether there is another page to be searched", examples: [false] }))),
    "totalCount": Type.Optional(Nullable(Type.Integer({ description: "Total number of items for the filters entered", examples: [2] }))),
    "limit": Type.Optional(Nullable(Type.Integer({ description: "Number of objects per page", examples: [10] }))),
    "offset": Type.Optional(Nullable(Type.Integer({ description: "Position of the object from which the page should be loaded", examples: [0] }))),
    "data": Type.Optional(Nullable(Type.Array(FiscalInfoTaxSituationCodeResponse))),
  })
export type FiscalInfoTaxSituationCodeListResponse = (typeof FiscalInfoTaxSituationCodeListResponse)['static']

export const FiscalInfoUpdateUseNationalPortalRequest = Type.Object({
    "enabled": Type.Boolean({ description: "Indicates whether the issuing of invoices through the national portal should be enabled or not.", examples: [true] }),
  })
export type FiscalInfoUpdateUseNationalPortalRequest = (typeof FiscalInfoUpdateUseNationalPortalRequest)['static']

export const FiscalInfoUpdateUseNationalPortalResponse = Type.Object({
    "success": Type.Optional(Nullable(Type.Boolean({ description: "Status of the request to change the use status of national portal for issuing invoices.", examples: [true] }))),
  })
export type FiscalInfoUpdateUseNationalPortalResponse = (typeof FiscalInfoUpdateUseNationalPortalResponse)['static']
