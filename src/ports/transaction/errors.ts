import { ValidateFunction } from 'ajv'
import { ErrorCode } from 'decentraland-transactions'
import { MetaTransactionErrorCode, TransactionData } from './types'

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

export class InvalidTransactionError extends Error {
  public code: ErrorCode

  constructor(message: string, _code?: ErrorCode) {
    super(message)
    this.code = _code || ErrorCode.INVALID_TRANSACTION
  }
}

export class InvalidSalePriceError extends Error {
  public code = ErrorCode.SALE_PRICE_TOO_LOW

  constructor(public minPrice: string, public salePrice: string) {
    super(
      `The transaction data contains a sale price that's lower than the allowed minimum. Sale price: ${salePrice} - Minimum price: ${minPrice}`
    )
  }
}

export class InvalidSchemaError extends Error {
  public code = ErrorCode.INVALID_SCHEMA

  constructor(
    public schemaErrors: ValidateFunction<TransactionData>['errors']
  ) {
    super(`Invalid transaction data. Errors: ${JSON.stringify(schemaErrors)}`)
  }
}

export class InvalidContractAddressError extends Error {
  public code = ErrorCode.INVALID_CONTRACT_ADDRESS

  constructor(public contractAddress: string) {
    super(`Invalid contract address. Contract address: ${contractAddress}`)
  }
}

export class QuotaReachedError extends Error {
  public code = ErrorCode.QUOTA_REACHED

  constructor(public from: string, public currentQuota: number) {
    super(
      `Max amount of transactions reached for address. Quota: ${currentQuota}`
    )
  }
}
