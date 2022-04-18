import { ValidateFunction } from 'ajv'
import { MetaTransactionErrorCode, TransactionData } from './types'

export class MetaTransactionError extends Error {
  // For more info on error codes, see https://docs.biconomy.io/api/native-meta-tx
  constructor(message: string, public code?: MetaTransactionErrorCode) {
    super(message)
    this.code = code
  }
}

export class InvalidSalePriceError extends Error {
  constructor(public minPrice: number, public salePrice: number) {
    super(
      "The transaction data contains a sale price that's lower than the allowed minimum"
    )
  }
}

export class InvalidSchemaError extends Error {
  constructor(
    public schemaErrors: ValidateFunction<TransactionData>['errors']
  ) {
    super('Invalid transaction data')
  }
}

export class InvalidContractAddressError extends Error {
  constructor(public contractAddress: string) {
    super('Invalid contract address')
  }
}

export class QuotaReachedError extends Error {
  constructor(public from: string, public currentQuota: number) {
    super('Max amount of transactions reached for address')
  }
}
