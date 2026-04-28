import {
  IConfigComponent,
  ILoggerComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { IFetchComponent } from '@well-known-components/http-server'
import { ChainId } from '@dcl/schemas'
import { ErrorCode } from 'decentraland-transactions'
import { metricDeclarations } from '../../../../src/metrics'
import { createOpenZeppelinComponent } from '../../../../src/ports/openzeppelin'
import { OpenZeppelinMetaTransactionComponent } from '../../../../src/ports/openzeppelin/types'
import {
  InvalidTransactionError,
  RelayerError,
  RelayerTimeout,
  TransactionData,
} from '../../../../src/types/transactions'
import { createCollection } from '../../../mocks/transactionData'

const mockGetGasPrice = jest.fn()

jest.mock('viem', () => {
  const actual = jest.requireActual('viem')
  return {
    ...actual,
    createPublicClient: () => ({
      getGasPrice: mockGetGasPrice,
    }),
  }
})

const RELAYER_URL = 'https://oz.example.com'
const RELAYER_ID = 'relayer-1'
const TX_ENDPOINT = `${RELAYER_URL}/api/v1/relayers/${RELAYER_ID}/transactions`

type MockResponse = {
  ok: boolean
  status: number
  json: jest.Mock
  text: jest.Mock
}

function createResponse(overrides: Partial<MockResponse> = {}): MockResponse {
  return {
    ok: true,
    status: 200,
    json: jest.fn(),
    text: jest.fn(),
    ...overrides,
  }
}

let openzeppelin: OpenZeppelinMetaTransactionComponent
let logs: ILoggerComponent
let metrics: IMetricsComponent<keyof typeof metricDeclarations>
let config: IConfigComponent
let fetcher: IFetchComponent
let fetchMock: jest.Mock
let getStringMock: jest.Mock
let transactionData: TransactionData

beforeEach(async () => {
  mockGetGasPrice.mockReset()
  fetchMock = jest.fn()
  getStringMock = jest.fn(async (key: string) => {
    switch (key) {
      case 'OZ_RELAYER_SPEED':
        return 'fast'
      case 'RPC_URL':
        return 'https://rpc.example.com'
      default:
        return undefined
    }
  })
  logs = {
    getLogger: () => ({
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
    }),
  } as ILoggerComponent
  metrics = {
    increment: jest.fn(),
    startTimer: jest.fn(),
    stopTimer: jest.fn(),
    reset: jest.fn(),
    resetAll: jest.fn(),
    observe: jest.fn(),
    decrement: jest.fn(),
    getValue: jest.fn(),
  } as IMetricsComponent<keyof typeof metricDeclarations>
  config = {
    requireString: async (key: string) => {
      switch (key) {
        case 'OZ_RELAYER_URL':
          return RELAYER_URL
        case 'OZ_RELAYER_API_KEY':
          return 'api-key'
        case 'OZ_RELAYER_ID':
          return RELAYER_ID
        default:
          throw new Error(`Unknown key: ${key}`)
      }
    },
    requireNumber: jest.fn(),
    getString: getStringMock,
    getNumber: jest.fn(),
  } as IConfigComponent
  fetcher = { fetch: fetchMock } as IFetchComponent
  transactionData = createCollection
  openzeppelin = await createOpenZeppelinComponent({
    config,
    logs,
    metrics,
    fetcher,
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('when sending a meta transaction', () => {
  describe('and the relayer responds immediately with a hash and success=true', () => {
    let response: MockResponse

    beforeEach(() => {
      response = createResponse({
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          data: {
            id: 'oz-tx-id',
            hash: '0xaTransactionHash',
            status: 'submitted',
            status_reason: null,
          },
          error: null,
        }),
      })
      fetchMock.mockResolvedValueOnce(response)
    })

    it('should resolve to the transaction hash', () => {
      return expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).resolves.toBe('0xaTransactionHash')
    })

    it('should increment the sent transactions metric', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_sent_transactions_openzeppelin'
      )
    })

    it('should call the relayer with to, data, speed, and a zero value', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      expect(fetchMock).toHaveBeenCalledWith(
        TX_ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            to: transactionData.params[0],
            data: transactionData.params[1],
            speed: 'fast',
            value: '0x0',
          }),
        })
      )
    })

    it('should include the bearer token and the content type headers', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      expect(fetchMock).toHaveBeenCalledWith(
        TX_ENDPOINT,
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-key',
          },
        })
      )
    })
  })

  describe('and the fetcher throws an error', () => {
    beforeEach(() => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))
    })

    it('should reject with a RelayerError carrying status 500 and the underlying message', () => {
      return expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).rejects.toThrow(new RelayerError(500, 'network down'))
    })

    it('should increment the service errors metric', async () => {
      await expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_service_errors_openzeppelin'
      )
    })
  })

  describe('and the relayer responds with a 422 status', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 422,
          text: jest.fn().mockResolvedValueOnce('validation failed'),
        })
      )
    })

    it('should reject with an InvalidTransactionError carrying the response body', () => {
      return expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).rejects.toThrow(
        new InvalidTransactionError(
          'validation failed',
          ErrorCode.EXPECTATION_FAILED
        )
      )
    })

    it('should increment the service errors metric', async () => {
      await expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_service_errors_openzeppelin'
      )
    })
  })

  describe('and the relayer responds with a 400 status', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 400,
          text: jest.fn().mockResolvedValueOnce('bad request'),
        })
      )
    })

    it('should reject with an InvalidTransactionError', () => {
      return expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).rejects.toThrow(
        new InvalidTransactionError('bad request', ErrorCode.EXPECTATION_FAILED)
      )
    })
  })

  describe('and the relayer responds with a 500 status', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 500,
          text: jest.fn().mockResolvedValueOnce('internal error'),
        })
      )
    })

    it('should reject with a RelayerError carrying the response status and body', () => {
      return expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).rejects.toThrow(new RelayerError(500, 'internal error'))
    })
  })

  describe('and the relayer responds with success=false in the body', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          json: jest.fn().mockResolvedValueOnce({
            success: false,
            data: null,
            error: 'relayer refused the transaction',
          }),
        })
      )
    })

    it('should reject with a RelayerError 500 using the error message from the body', () => {
      return expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).rejects.toThrow(
        new RelayerError(500, 'relayer refused the transaction')
      )
    })

    it('should increment the service errors metric', async () => {
      await expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_service_errors_openzeppelin'
      )
    })
  })

  describe('and the relayer responds with success=true but no hash yet', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          json: jest.fn().mockResolvedValueOnce({
            success: true,
            data: {
              id: 'oz-tx-id',
              hash: null,
              status: 'pending',
              status_reason: null,
            },
            error: null,
          }),
        })
      )
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    describe('and polling the transaction returns a hash', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          createResponse({
            json: jest.fn().mockResolvedValueOnce({
              success: true,
              data: {
                id: 'oz-tx-id',
                hash: '0xpolledHash',
                status: 'submitted',
                status_reason: null,
              },
              error: null,
            }),
          })
        )
      })

      it('should resolve to the polled transaction hash', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        await jest.advanceTimersByTimeAsync(2000)
        await expect(promise).resolves.toBe('0xpolledHash')
      })
    })

    describe('and polling the transaction returns a terminal failed status', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          createResponse({
            json: jest.fn().mockResolvedValueOnce({
              success: true,
              data: {
                id: 'oz-tx-id',
                hash: null,
                status: 'failed',
                status_reason: 'execution reverted',
              },
              error: null,
            }),
          })
        )
      })

      it('should reject with an InvalidTransactionError carrying the status reason', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(2000)
        await expect(promise).rejects.toThrow(
          new InvalidTransactionError(
            'Transaction failed: execution reverted',
            ErrorCode.EXPECTATION_FAILED
          )
        )
      })

      it('should increment the service errors metric', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(2000)
        await expect(promise).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_service_errors_openzeppelin'
        )
      })
    })

    describe('and polling exhausts the maximum number of attempts', () => {
      beforeEach(() => {
        // Every poll attempt returns a non-terminal status with no hash
        fetchMock.mockResolvedValue(
          createResponse({
            json: jest.fn().mockResolvedValue({
              success: true,
              data: {
                id: 'oz-tx-id',
                hash: null,
                status: 'pending',
                status_reason: null,
              },
              error: null,
            }),
          })
        )
      })

      it('should reject with a RelayerTimeout', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        // Suppress unhandled rejection until we assert on it
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(2000 * 30)
        await expect(promise).rejects.toThrow(
          new RelayerTimeout('The limit of status checks was reached')
        )
      })

      it('should increment the timeout metric', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(2000 * 30)
        await expect(promise).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_timeout_openzeppelin'
        )
      })
    })
  })
})

describe('when getting the network gas price', () => {
  describe('and the RPC client returns a gas price', () => {
    beforeEach(() => {
      mockGetGasPrice.mockResolvedValueOnce(42n)
    })

    it('should resolve to the gas price as a bigint', () => {
      return expect(
        openzeppelin.getNetworkGasPrice(ChainId.MATIC_AMOY)
      ).resolves.toBe(42n)
    })
  })

  describe('and the RPC client throws', () => {
    beforeEach(() => {
      mockGetGasPrice.mockRejectedValueOnce(new Error('rpc unreachable'))
    })

    it('should resolve to null instead of propagating the error', () => {
      return expect(
        openzeppelin.getNetworkGasPrice(ChainId.MATIC_AMOY)
      ).resolves.toBeNull()
    })
  })
})

describe('when RPC_URL is not configured', () => {
  let openzeppelinWithoutRpc: OpenZeppelinMetaTransactionComponent

  beforeEach(async () => {
    getStringMock.mockImplementation(async (key: string) => {
      if (key === 'OZ_RELAYER_SPEED') return 'fast'
      return undefined
    })
    openzeppelinWithoutRpc = await createOpenZeppelinComponent({
      config,
      logs,
      metrics,
      fetcher,
    })
  })

  describe('and getting the network gas price', () => {
    it('should resolve to null without calling the RPC client', async () => {
      await expect(
        openzeppelinWithoutRpc.getNetworkGasPrice(ChainId.MATIC_AMOY)
      ).resolves.toBeNull()
      expect(mockGetGasPrice).not.toHaveBeenCalled()
    })
  })
})

