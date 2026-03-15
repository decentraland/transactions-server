import { IHttpServerComponent } from '@well-known-components/interfaces'
import { ErrorCode } from 'decentraland-transactions'
import { createTransactionMiddleware } from '../../../src/logic/transaction-middleware'
import {
  HighCongestionError,
  InvalidContractAddressError,
  InvalidSalePriceError,
  InvalidSchemaError,
  InvalidTransactionError,
  QuotaReachedError,
  SimulateTransactionError,
} from '../../../src/types/transactions/errors'
import { StatusCode } from '../../../src/types/HTTPResponse'
import { AppComponents } from '../../../src/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let middleware: IHttpServerComponent.IRequestHandler<any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let context: any
let next: jest.Mock
let loggerDebug: jest.Mock
let loggerInfo: jest.Mock
let loggerWarn: jest.Mock
let loggerError: jest.Mock
let checkDataMock: jest.Mock
let transactionData: { from: string; params: string[] }

beforeEach(() => {
  loggerDebug = jest.fn()
  loggerInfo = jest.fn()
  loggerWarn = jest.fn()
  loggerError = jest.fn()
  checkDataMock = jest.fn()
  next = jest.fn()

  transactionData = {
    from: '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b',
    params: ['0x1234', '0x5678'],
  }

  const components = {
    logs: {
      getLogger: jest.fn().mockReturnValue({
        debug: loggerDebug,
        info: loggerInfo,
        warn: loggerWarn,
        error: loggerError,
        log: jest.fn(),
      }),
    },
    transaction: {
      checkData: checkDataMock,
      sendMetaTransaction: jest.fn(),
      insert: jest.fn(),
      getByUserAddress: jest.fn(),
    },
  } as unknown as Pick<AppComponents, 'logs' | 'transaction'>

  middleware = createTransactionMiddleware(components)

  context = {
    request: {
      method: 'POST',
      url: 'http://localhost/v1/transactions',
      clone: () => ({
        json: () => Promise.resolve({ transactionData }),
      }),
    },
  }
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('when the request is valid and checkData passes', () => {
  let nextResponse: IHttpServerComponent.IResponse

  beforeEach(() => {
    checkDataMock.mockResolvedValueOnce(undefined)
    nextResponse = { status: 200, body: { ok: true, txHash: '0xabc' } }
    next.mockResolvedValueOnce(nextResponse)
  })

  it('should call next and return its response', async () => {
    const result = await middleware(context, next)

    expect(result).toEqual(nextResponse)
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe('when transactionData is missing from the request body', () => {
  beforeEach(() => {
    context = {
      request: {
        method: 'POST',
        url: 'http://localhost/v1/transactions',
        clone: () => ({
          json: () => Promise.resolve({}),
        }),
      },
    }
  })

  it('should respond with a 400 and the missing data message', async () => {
    const result = await middleware(context, next)

    expect(result).toEqual({
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message:
          'Missing transaction data. Please add it to the body of the request as `transactionData`',
      },
    })
  })

  it('should log a warning', async () => {
    await middleware(context, next)

    expect(loggerWarn).toHaveBeenCalledWith(
      'Transaction rejected due to missing transaction data'
    )
  })
})

describe('when checkData throws a HighCongestionError', () => {
  let error: HighCongestionError

  beforeEach(() => {
    error = new HighCongestionError('2100000000', '2000000000')
    checkDataMock.mockRejectedValueOnce(error)
  })

  it('should respond with a 503 and the error', async () => {
    const result = await middleware(context, next)

    expect(result).toEqual({
      status: StatusCode.SERVICE_UNAVAILABLE,
      body: {
        ok: false,
        message: error.message,
        code: ErrorCode.HIGH_CONGESTION,
      },
    })
  })

  it('should log a warning with the address and gas price details', async () => {
    await middleware(context, next)

    expect(loggerWarn).toHaveBeenCalledWith(
      'Transaction rejected due to high network congestion',
      {
        from: '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b',
        currentGasPrice: '2100000000',
        maxGasPriceAllowed: '2000000000',
      }
    )
  })
})

describe('when checkData throws a QuotaReachedError', () => {
  let error: QuotaReachedError

  beforeEach(() => {
    error = new QuotaReachedError(
      '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b',
      10
    )
    checkDataMock.mockRejectedValueOnce(error)
  })

  it('should respond with a 429 and the error', async () => {
    const result = await middleware(context, next)

    expect(result).toEqual({
      status: StatusCode.TOO_MANY_REQUESTS,
      body: {
        ok: false,
        message: error.message,
        code: ErrorCode.QUOTA_REACHED,
      },
    })
  })

  it('should log a warning with the address and quota', async () => {
    await middleware(context, next)

    expect(loggerWarn).toHaveBeenCalledWith(
      'Transaction rejected due to quota reached',
      {
        from: '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b',
        currentQuota: '10',
      }
    )
  })
})

describe('when checkData throws an InvalidSchemaError', () => {
  let error: InvalidSchemaError

  beforeEach(() => {
    const schemaErrors = [
      { message: 'must have required property "from"' },
    ] as InvalidSchemaError['schemaErrors']
    error = new InvalidSchemaError(schemaErrors)
    checkDataMock.mockRejectedValueOnce(error)
  })

  it('should respond with a 400 and the error', async () => {
    const result = await middleware(context, next)

    expect(result).toEqual({
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: error.message,
        code: ErrorCode.INVALID_SCHEMA,
      },
    })
  })

  it('should log a warning with the address and schema error details', async () => {
    await middleware(context, next)

    expect(loggerWarn).toHaveBeenCalledWith(
      'Transaction rejected due to invalid schema',
      {
        from: '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b',
        schemaErrors: JSON.stringify(error.schemaErrors),
      }
    )
  })
})

describe('when checkData throws an InvalidSalePriceError', () => {
  let error: InvalidSalePriceError

  beforeEach(() => {
    error = new InvalidSalePriceError('1000000000000000000', '500000000000000000')
    checkDataMock.mockRejectedValueOnce(error)
  })

  it('should respond with a 400 and the error', async () => {
    const result = await middleware(context, next)

    expect(result).toEqual({
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: error.message,
        code: ErrorCode.SALE_PRICE_TOO_LOW,
      },
    })
  })

  it('should log a warning with the address and price details', async () => {
    await middleware(context, next)

    expect(loggerWarn).toHaveBeenCalledWith(
      'Transaction rejected due to sale price too low',
      {
        from: '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b',
        minPrice: '1000000000000000000',
        salePrice: '500000000000000000',
      }
    )
  })
})

describe('when checkData throws an InvalidContractAddressError', () => {
  let error: InvalidContractAddressError

  beforeEach(() => {
    error = new InvalidContractAddressError('0xdeadbeef')
    checkDataMock.mockRejectedValueOnce(error)
  })

  it('should respond with a 400 and the error', async () => {
    const result = await middleware(context, next)

    expect(result).toEqual({
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: error.message,
        code: ErrorCode.INVALID_CONTRACT_ADDRESS,
      },
    })
  })

  it('should log a warning with the address and contract address', async () => {
    await middleware(context, next)

    expect(loggerWarn).toHaveBeenCalledWith(
      'Transaction rejected due to invalid contract address',
      {
        from: '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b',
        contractAddress: '0xdeadbeef',
      }
    )
  })
})

describe('when checkData throws an InvalidTransactionError', () => {
  let error: InvalidTransactionError

  beforeEach(() => {
    error = new InvalidTransactionError('Transaction is invalid')
    checkDataMock.mockRejectedValueOnce(error)
  })

  it('should respond with a 400 and the error', async () => {
    const result = await middleware(context, next)

    expect(result).toEqual({
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: error.message,
        code: ErrorCode.INVALID_TRANSACTION,
      },
    })
  })

  it('should log a warning with the address and error message', async () => {
    await middleware(context, next)

    expect(loggerWarn).toHaveBeenCalledWith(
      'Transaction rejected due to invalid transaction data',
      {
        from: '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b',
        message: 'Transaction is invalid',
      }
    )
  })
})

describe('when checkData throws a SimulateTransactionError', () => {
  let error: SimulateTransactionError

  beforeEach(() => {
    error = new SimulateTransactionError('Simulation failed')
    checkDataMock.mockRejectedValueOnce(error)
  })

  it('should respond with a 400 and the error', async () => {
    const result = await middleware(context, next)

    expect(result).toEqual({
      status: StatusCode.BAD_REQUEST,
      body: {
        ok: false,
        message: error.message,
        code: ErrorCode.INVALID_TRANSACTION,
      },
    })
  })

  it('should log a warning with the address and error message', async () => {
    await middleware(context, next)

    expect(loggerWarn).toHaveBeenCalledWith(
      'Transaction rejected due to invalid transaction data',
      {
        from: '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b',
        message: error.message,
      }
    )
  })
})

describe('when checkData throws an unexpected error', () => {
  let error: Error

  beforeEach(() => {
    error = new Error('Something went wrong')
    checkDataMock.mockRejectedValueOnce(error)
  })

  it('should respond with a 500 and the error', async () => {
    const result = await middleware(context, next)

    expect(result).toEqual({
      status: StatusCode.ERROR,
      body: {
        ok: false,
        message: 'Something went wrong',
        code: undefined,
      },
    })
  })

  it('should log the error with the address, message, and stack trace', async () => {
    await middleware(context, next)

    expect(loggerError).toHaveBeenCalledWith(
      'Unexpected error during transaction validation',
      {
        from: '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b',
        message: 'Something went wrong',
        stack: expect.stringContaining('Something went wrong'),
      }
    )
  })
})
