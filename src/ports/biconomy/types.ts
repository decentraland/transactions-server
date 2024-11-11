import { ErrorCode } from 'decentraland-transactions'
import {
  IMetaTransactionProviderComponent,
  TransactionData,
} from '../../types/transactions/transactions'

export type MetaTransactionRequest = TransactionData & {
  apiId: string
}

export type BiconomyMetaTransactionComponent = IMetaTransactionProviderComponent
export type MetaTransactionResponse = {
  txHash?: string
  log: string
  flag: MetaTransactionStatus
  code?: MetaTransactionErrorCode
  message?: string
}

export enum MetaTransactionStatus {
  OK = 200,
  NOT_FOUND = 404,
  CONFLICT = 409,
  EXPECTATION_FAILED = 417,
  INTERNAL_SERVER_ERROR = 500,
}

// For more info on error codes, see https://docs.biconomy.io/api/native-meta-tx
export enum MetaTransactionErrorCode {
  DAPP_LIMIT_REACHED = 150,
  USER_LIMIT_REACHED = 151,
  API_LIMIT_REACHED = 152,
  GAS_LIMIT_REACHED = 153,
  EXPECTATION_FAILED = 417,
}

export type GasPriceResponse = {
  code: number
  message: string
  gasPrice: {
    value: number
    unit: string
  }
  networkId: string
}

export function toErrorCode(
  metaTransactionCode: MetaTransactionErrorCode
): ErrorCode {
  const {
    DAPP_LIMIT_REACHED,
    USER_LIMIT_REACHED,
    API_LIMIT_REACHED,
    GAS_LIMIT_REACHED,
    EXPECTATION_FAILED,
  } = MetaTransactionErrorCode

  return {
    [DAPP_LIMIT_REACHED]: ErrorCode.DAPP_LIMIT_REACHED,
    [USER_LIMIT_REACHED]: ErrorCode.USER_LIMIT_REACHED,
    [API_LIMIT_REACHED]: ErrorCode.API_LIMIT_REACHED,
    [GAS_LIMIT_REACHED]: ErrorCode.GAS_LIMIT_REACHED,
    [EXPECTATION_FAILED]: ErrorCode.EXPECTATION_FAILED,
  }[metaTransactionCode]
}
