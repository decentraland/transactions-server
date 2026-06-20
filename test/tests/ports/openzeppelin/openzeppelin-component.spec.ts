import {
  IConfigComponent,
  ILoggerComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { IFetchComponent } from '@dcl/core-commons'
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
const TX_ID = 'oz-tx-id'
const TX_DETAIL_ENDPOINT = `${TX_ENDPOINT}/${TX_ID}`
const SLEEP_MS = 100
const MAX_CHECKS = 5

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

function postResponse(data: {
  hash?: string | null
  status?: string
  status_reason?: string | null
}) {
  return createResponse({
    json: jest.fn().mockResolvedValueOnce({
      success: true,
      data: {
        id: TX_ID,
        hash: data.hash ?? null,
        status: data.status ?? 'pending',
        status_reason: data.status_reason ?? null,
      },
      error: null,
    }),
  })
}

function pollResponse(data: {
  hash?: string | null
  status?: string
  status_reason?: string | null
}) {
  return createResponse({
    json: jest.fn().mockResolvedValueOnce({
      success: true,
      data: {
        id: TX_ID,
        hash: data.hash ?? null,
        status: data.status ?? 'pending',
        status_reason: data.status_reason ?? null,
      },
      error: null,
    }),
  })
}

let openzeppelin: OpenZeppelinMetaTransactionComponent
let logs: ILoggerComponent
let metrics: IMetricsComponent<keyof typeof metricDeclarations>
let config: IConfigComponent
let fetcher: IFetchComponent
let fetchMock: jest.Mock
let getStringMock: jest.Mock
let getNumberMock: jest.Mock
let transactionData: TransactionData

beforeEach(async () => {
  jest.useFakeTimers()
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
  getNumberMock = jest.fn(async (key: string) => {
    switch (key) {
      case 'OZ_MAX_STATUS_CHECKS':
        return MAX_CHECKS
      case 'OZ_SLEEP_TIME_BETWEEN_CHECKS_MS':
        return SLEEP_MS
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
    getNumber: getNumberMock,
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
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('when sending a meta transaction', () => {
  describe('and the relayer responds immediately with a hash and a broadcast status', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        postResponse({ hash: '0xaTransactionHash', status: 'submitted' })
      )
    })

    it('should resolve to the transaction hash', () => {
      return expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).resolves.toBe('0xaTransactionHash')
    })

    it('should increment the sent transactions metric', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      expect(metrics.increment).toHaveBeenCalledWith('dcl_sent_transactions', {
        relayer: 'openzeppelin',
      })
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

    it('should not issue a DELETE for the transaction', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      const deleteCalls = fetchMock.mock.calls.filter(
        ([, init]) => init?.method === 'DELETE'
      )
      expect(deleteCalls).toHaveLength(0)
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
        'dcl_error_service_errors',
        { relayer: 'openzeppelin' }
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
        'dcl_error_service_errors',
        { relayer: 'openzeppelin' }
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
        'dcl_error_service_errors',
        { relayer: 'openzeppelin' }
      )
    })
  })

  describe('and the relayer responds with success=true but no hash yet', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        postResponse({ hash: null, status: 'pending' })
      )
    })

    describe('and polling returns a broadcast status with a hash', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          pollResponse({ hash: '0xpolledHash', status: 'submitted' })
        )
      })

      it('should resolve to the polled transaction hash', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        await jest.advanceTimersByTimeAsync(SLEEP_MS)
        await expect(promise).resolves.toBe('0xpolledHash')
      })
    })

    describe('and polling returns a hash but the status is still pending', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          pollResponse({ hash: '0xpremature', status: 'pending' })
        )
        fetchMock.mockResolvedValueOnce(
          pollResponse({ hash: '0xpremature', status: 'submitted' })
        )
      })

      it('should keep polling until the status reports broadcast', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        await jest.advanceTimersByTimeAsync(SLEEP_MS * 2)
        await expect(promise).resolves.toBe('0xpremature')
      })
    })

    describe('and polling returns a hash with status sent (relayer attempted but RPC may have rejected)', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          pollResponse({ hash: '0xstuck', status: 'sent' })
        )
        fetchMock.mockResolvedValueOnce(
          pollResponse({ hash: '0xstuck', status: 'submitted' })
        )
      })

      it('should keep polling until the status advances to submitted', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        await jest.advanceTimersByTimeAsync(SLEEP_MS * 2)
        await expect(promise).resolves.toBe('0xstuck')
      })
    })

    describe('and polling returns a terminal failed status', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          pollResponse({
            hash: null,
            status: 'failed',
            status_reason: 'execution reverted',
          })
        )
      })

      it('should reject with an InvalidTransactionError carrying the status reason', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(SLEEP_MS)
        await expect(promise).rejects.toThrow(
          new InvalidTransactionError(
            'Transaction failed: execution reverted',
            ErrorCode.EXPECTATION_FAILED
          )
        )
      })

      it('should increment the reverted transactions metric', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(SLEEP_MS)
        await expect(promise).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_reverted_transactions',
          { relayer: 'openzeppelin' }
        )
      })
    })

    describe('and polling returns a terminal expired status', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          pollResponse({
            hash: null,
            status: 'expired',
            status_reason: 'gas price oracle refused to bump further',
          })
        )
      })

      it('should reject with an InvalidTransactionError naming the status', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(SLEEP_MS)
        await expect(promise).rejects.toThrow(
          new InvalidTransactionError(
            'Transaction expired: gas price oracle refused to bump further',
            ErrorCode.EXPECTATION_FAILED
          )
        )
      })

      it('should fall back to the service errors metric when the reason is unmapped', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(SLEEP_MS)
        await expect(promise).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_service_errors',
          { relayer: 'openzeppelin' }
        )
      })
    })

    describe('and polling returns a canceled status', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          pollResponse({
            hash: null,
            status: 'canceled',
            status_reason: 'user requested cancellation',
          })
        )
      })

      it('should increment the cancelled transactions metric', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(SLEEP_MS)
        await expect(promise).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_cancelled_transactions',
          { relayer: 'openzeppelin' }
        )
      })
    })

    describe('and polling exhausts the maximum number of status checks', () => {
      // Each child describe sets a full fetchMock implementation keyed off the
      // request method so that POST, GET (poll), and DELETE (cancel) responses
      // never get swapped by mock-queue ordering.

      describe('and the cancel request succeeds', () => {
        beforeEach(() => {
          fetchMock.mockReset()
          fetchMock.mockImplementation(async (_url: string, init: any) => {
            if (init?.method === 'POST') {
              return postResponse({ hash: null, status: 'pending' })
            }
            if (init?.method === 'DELETE') {
              return createResponse({ ok: true, status: 200 })
            }
            return pollResponse({ hash: null, status: 'pending' })
          })
        })

        it('should issue a DELETE on the transaction detail endpoint with the bearer token', async () => {
          const promise = openzeppelin.sendMetaTransaction(transactionData)
          promise.catch(() => undefined)
          await jest.advanceTimersByTimeAsync(SLEEP_MS * MAX_CHECKS)
          await expect(promise).rejects.toThrow()
          expect(fetchMock).toHaveBeenCalledWith(
            TX_DETAIL_ENDPOINT,
            expect.objectContaining({
              method: 'DELETE',
              headers: expect.objectContaining({
                Authorization: 'Bearer api-key',
              }),
            })
          )
        })

        it('should pass an explicit timeout on the DELETE request', async () => {
          const promise = openzeppelin.sendMetaTransaction(transactionData)
          promise.catch(() => undefined)
          await jest.advanceTimersByTimeAsync(SLEEP_MS * MAX_CHECKS)
          await expect(promise).rejects.toThrow()
          const deleteCall = fetchMock.mock.calls.find(
            ([, init]) => init?.method === 'DELETE'
          )
          expect(deleteCall).toBeDefined()
          expect(deleteCall?.[1]).toEqual(
            expect.objectContaining({
              timeout: expect.any(Number),
            })
          )
        })

        it('should reject with a RelayerTimeout', async () => {
          const promise = openzeppelin.sendMetaTransaction(transactionData)
          promise.catch(() => undefined)
          await jest.advanceTimersByTimeAsync(SLEEP_MS * MAX_CHECKS)
          await expect(promise).rejects.toThrow(
            new RelayerTimeout('The limit of status checks was reached')
          )
        })

        it('should increment the timeout metric', async () => {
          const promise = openzeppelin.sendMetaTransaction(transactionData)
          promise.catch(() => undefined)
          await jest.advanceTimersByTimeAsync(SLEEP_MS * MAX_CHECKS)
          await expect(promise).rejects.toThrow()
          expect(metrics.increment).toHaveBeenCalledWith('dcl_error_timeout', {
            relayer: 'openzeppelin',
          })
        })

        it('should not increment the service errors metric for the cancel', async () => {
          const promise = openzeppelin.sendMetaTransaction(transactionData)
          promise.catch(() => undefined)
          await jest.advanceTimersByTimeAsync(SLEEP_MS * MAX_CHECKS)
          await expect(promise).rejects.toThrow()
          expect(metrics.increment).not.toHaveBeenCalledWith(
            'dcl_error_service_errors',
            { relayer: 'openzeppelin' }
          )
        })
      })

      describe('and the cancel request responds with a non-2xx status', () => {
        beforeEach(() => {
          fetchMock.mockReset()
          fetchMock.mockImplementation(async (_url: string, init: any) => {
            if (init?.method === 'POST') {
              return postResponse({ hash: null, status: 'pending' })
            }
            if (init?.method === 'DELETE') {
              return createResponse({
                ok: false,
                status: 500,
                text: jest.fn().mockResolvedValueOnce('relayer unavailable'),
              })
            }
            return pollResponse({ hash: null, status: 'pending' })
          })
        })

        it('should still reject with a RelayerTimeout', async () => {
          const promise = openzeppelin.sendMetaTransaction(transactionData)
          promise.catch(() => undefined)
          await jest.advanceTimersByTimeAsync(SLEEP_MS * MAX_CHECKS)
          await expect(promise).rejects.toThrow(
            new RelayerTimeout('The limit of status checks was reached')
          )
        })

        it('should increment the service errors metric for the failed cancel', async () => {
          const promise = openzeppelin.sendMetaTransaction(transactionData)
          promise.catch(() => undefined)
          await jest.advanceTimersByTimeAsync(SLEEP_MS * MAX_CHECKS)
          await expect(promise).rejects.toThrow()
          expect(metrics.increment).toHaveBeenCalledWith(
            'dcl_error_service_errors',
            { relayer: 'openzeppelin' }
          )
        })

        it('should still increment the timeout metric', async () => {
          const promise = openzeppelin.sendMetaTransaction(transactionData)
          promise.catch(() => undefined)
          await jest.advanceTimersByTimeAsync(SLEEP_MS * MAX_CHECKS)
          await expect(promise).rejects.toThrow()
          expect(metrics.increment).toHaveBeenCalledWith('dcl_error_timeout', {
            relayer: 'openzeppelin',
          })
        })
      })

      describe('and the cancel request throws', () => {
        beforeEach(() => {
          fetchMock.mockReset()
          fetchMock.mockImplementation(async (_url: string, init: any) => {
            if (init?.method === 'POST') {
              return postResponse({ hash: null, status: 'pending' })
            }
            if (init?.method === 'DELETE') {
              throw new Error('connection reset')
            }
            return pollResponse({ hash: null, status: 'pending' })
          })
        })

        it('should still reject with a RelayerTimeout', async () => {
          const promise = openzeppelin.sendMetaTransaction(transactionData)
          promise.catch(() => undefined)
          await jest.advanceTimersByTimeAsync(SLEEP_MS * MAX_CHECKS)
          await expect(promise).rejects.toThrow(
            new RelayerTimeout('The limit of status checks was reached')
          )
        })

        it('should increment the service errors metric for the failed cancel', async () => {
          const promise = openzeppelin.sendMetaTransaction(transactionData)
          promise.catch(() => undefined)
          await jest.advanceTimersByTimeAsync(SLEEP_MS * MAX_CHECKS)
          await expect(promise).rejects.toThrow()
          expect(metrics.increment).toHaveBeenCalledWith(
            'dcl_error_service_errors',
            { relayer: 'openzeppelin' }
          )
        })
      })
    })

    describe('and a poll request rejects with a network error before the relayer broadcasts', () => {
      beforeEach(() => {
        fetchMock.mockRejectedValueOnce(new Error('connection reset'))
        fetchMock.mockResolvedValueOnce(
          pollResponse({ hash: '0xrecovered', status: 'submitted' })
        )
      })

      it('should swallow the error and resolve once the next poll succeeds', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        await jest.advanceTimersByTimeAsync(SLEEP_MS * 2)
        await expect(promise).resolves.toBe('0xrecovered')
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

describe('when fetching the relayer addresses', () => {
  const LIST_RELAYERS_URL = `${RELAYER_URL}/api/v1/relayers/`

  describe('and the API responds with two relayers', () => {
    let response: MockResponse

    beforeEach(() => {
      response = createResponse({
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          data: [
            { address: '0xAAAA1111aaaa2222AAAA3333aaaa4444AAAA5555' },
            { address: '0xBBBB1111bbbb2222BBBB3333bbbb4444BBBB5555' },
          ],
          error: null,
        }),
      })
      fetchMock.mockResolvedValueOnce(response)
    })

    it('should return both addresses lowercased in a Set', async () => {
      const addresses = await openzeppelin.getRelayerAddresses()
      expect(addresses).toEqual(
        new Set([
          '0xaaaa1111aaaa2222aaaa3333aaaa4444aaaa5555',
          '0xbbbb1111bbbb2222bbbb3333bbbb4444bbbb5555',
        ])
      )
    })

    it('should call the OZ listRelayers endpoint with bearer auth and a timeout', async () => {
      await openzeppelin.getRelayerAddresses()
      expect(fetchMock).toHaveBeenCalledWith(
        LIST_RELAYERS_URL,
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer api-key',
          },
          timeout: expect.any(Number),
        })
      )
    })

    describe('and getRelayerAddresses is called again before the cache expires', () => {
      beforeEach(async () => {
        await openzeppelin.getRelayerAddresses()
      })

      it('should return the cached set without re-fetching', async () => {
        const addresses = await openzeppelin.getRelayerAddresses()
        expect(addresses).toEqual(
          new Set([
            '0xaaaa1111aaaa2222aaaa3333aaaa4444aaaa5555',
            '0xbbbb1111bbbb2222bbbb3333bbbb4444bbbb5555',
          ])
        )
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })
    })

    describe('and getRelayerAddresses is called again after the cache TTL elapses', () => {
      let secondResponse: MockResponse

      beforeEach(async () => {
        await openzeppelin.getRelayerAddresses()
        // Default TTL is 1h; advance the wall clock past it.
        jest.setSystemTime(Date.now() + 60 * 60 * 1000 + 1)
        secondResponse = createResponse({
          json: jest.fn().mockResolvedValueOnce({
            success: true,
            data: [{ address: '0xCCCC1111cccc2222CCCC3333cccc4444CCCC5555' }],
            error: null,
          }),
        })
        fetchMock.mockResolvedValueOnce(secondResponse)
      })

      it('should re-fetch and replace the cached set', async () => {
        const addresses = await openzeppelin.getRelayerAddresses()
        expect(addresses).toEqual(
          new Set(['0xcccc1111cccc2222cccc3333cccc4444cccc5555'])
        )
        expect(fetchMock).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('and getRelayerAddresses is called twice concurrently on a cold cache', () => {
    let resolveFetch: (value: MockResponse) => void
    let response: MockResponse

    beforeEach(() => {
      response = createResponse({
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          data: [{ address: '0xAAAA1111aaaa2222AAAA3333aaaa4444AAAA5555' }],
          error: null,
        }),
      })
      // Hold the fetcher in-flight so both callers race the same pending fetch.
      fetchMock.mockImplementationOnce(
        () =>
          new Promise<MockResponse>((resolve) => {
            resolveFetch = resolve
          })
      )
    })

    it('should invoke the fetcher exactly once and return the same set to both callers', async () => {
      const first = openzeppelin.getRelayerAddresses()
      const second = openzeppelin.getRelayerAddresses()
      resolveFetch(response)
      const [a, b] = await Promise.all([first, second])

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(a).toEqual(new Set(['0xaaaa1111aaaa2222aaaa3333aaaa4444aaaa5555']))
      expect(b).toBe(a)
    })
  })

  describe('and the API responds with a non-2xx status on cold start', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 503,
          text: jest.fn().mockResolvedValueOnce('Service Unavailable'),
        })
      )
    })

    it('should return an empty Set without throwing', async () => {
      await expect(openzeppelin.getRelayerAddresses()).resolves.toEqual(
        new Set()
      )
    })

    it('should increment the refresh-failed metric', async () => {
      await openzeppelin.getRelayerAddresses()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_relayer_addresses_refresh_failed'
      )
    })
  })

  describe('and the fetcher throws on cold start', () => {
    beforeEach(() => {
      fetchMock.mockRejectedValueOnce(new Error('connection reset'))
    })

    it('should return an empty Set and increment the refresh-failed metric', async () => {
      await expect(openzeppelin.getRelayerAddresses()).resolves.toEqual(
        new Set()
      )
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_relayer_addresses_refresh_failed'
      )
    })
  })

  describe('and the fetcher throws after a successful warm cache', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          json: jest.fn().mockResolvedValueOnce({
            success: true,
            data: [{ address: '0xAAAA1111aaaa2222AAAA3333aaaa4444AAAA5555' }],
            error: null,
          }),
        })
      )
      await openzeppelin.getRelayerAddresses()
      jest.setSystemTime(Date.now() + 60 * 60 * 1000 + 1)
      fetchMock.mockRejectedValueOnce(new Error('connection reset'))
    })

    it('should return the previously cached set instead of an empty one', async () => {
      const addresses = await openzeppelin.getRelayerAddresses()
      expect(addresses).toEqual(
        new Set(['0xaaaa1111aaaa2222aaaa3333aaaa4444aaaa5555'])
      )
    })

    it('should increment the refresh-failed metric', async () => {
      await openzeppelin.getRelayerAddresses()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_relayer_addresses_refresh_failed'
      )
    })
  })

  describe('and the API returns a payload with no data field', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          json: jest.fn().mockResolvedValueOnce({
            success: false,
            data: null,
            error: 'something broke',
          }),
        })
      )
    })

    it('should return an empty Set and increment the refresh-failed metric', async () => {
      await expect(openzeppelin.getRelayerAddresses()).resolves.toEqual(
        new Set()
      )
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_relayer_addresses_refresh_failed'
      )
    })
  })

  describe('and an entry in the response is missing an address', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          json: jest.fn().mockResolvedValueOnce({
            success: true,
            data: [
              { address: '0xAAAA1111aaaa2222AAAA3333aaaa4444AAAA5555' },
              { address: undefined },
              { address: '' },
            ],
            error: null,
          }),
        })
      )
    })

    it('should drop the empty entries and keep the valid ones lowercased', async () => {
      const addresses = await openzeppelin.getRelayerAddresses()
      expect(addresses).toEqual(
        new Set(['0xaaaa1111aaaa2222aaaa3333aaaa4444aaaa5555'])
      )
    })
  })
})
