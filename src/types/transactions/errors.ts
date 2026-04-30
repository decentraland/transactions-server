import { ValidateFunction } from 'ajv'
import { ErrorCode } from 'decentraland-transactions'
import { TransactionData } from './transactions'

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

export class InvalidFunctionSelectorError extends Error {
  public code = ErrorCode.INVALID_TRANSACTION

  constructor(public selector: string) {
    super(
      `Invalid function selector. Only executeMetaTransaction (0x0c53c51c or 0xd8ed1acc) is allowed. Received: ${selector}`
    )
  }
}

export class SelfRelayUserAddressError extends Error {
  public code = ErrorCode.INVALID_TRANSACTION

  constructor(public userAddress: string) {
    super('Invalid transaction data.')
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

export class HighCongestionError extends Error {
  public code = ErrorCode.HIGH_CONGESTION

  constructor(
    public currentGasPrice: string,
    public maxGasPriceAllowed: string
  ) {
    super(
      `Current network gas price ${currentGasPrice} exceeds max gas price allowed ${maxGasPriceAllowed}`
    )
  }
}

export class RelayerError extends Error {
  constructor(public statusCode: number, public message: string) {
    super(`The relayer responded with a ${statusCode} status code: ${message}`)
  }
}

export class RelayerTimeout extends Error {
  constructor(public message: string) {
    super(`The relayer took too long to respond: ${message}`)
  }
}

export class SimulateTransactionError extends Error {
  public code = ErrorCode.INVALID_TRANSACTION

  constructor(public message: string) {
    super(`Error simulating transaction: ${message}`)
  }
}
