import { ValidateFunction } from 'ajv'
import { MetaTransactionCode, TransactionData } from './types'

export enum ErrorCode {
  META_TRANSACTION = 1,
  INVALID_SALE_PRICE = 2,
  INVALID_SCHEMA = 3,
  INVALID_CONTRACT_ADDRESS = 4,
  QUOTA_REACHED = 5,
}

export class MetaTransactionError extends Error {
  public code = ErrorCode.META_TRANSACTION

  // For more info on error codes, see https://docs.biconomy.io/api/native-meta-tx
  constructor(message: string, public transactionCode?: MetaTransactionCode) {
    super(message)
    this.transactionCode = transactionCode
  }
}

export class InvalidSalePriceError extends Error {
  public code = ErrorCode.INVALID_SALE_PRICE

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
