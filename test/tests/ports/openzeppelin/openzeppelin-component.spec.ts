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
  // Fake timers globally so the fire-and-forget retry tracker (started by
  // sendMetaTransaction) never schedules a real setTimeout that would leak
  // across tests.
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
  jest.useRealTimers()
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

  describe('and the relayer responds with a 422 status whose body mentions insufficient balance', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          ok: false,
          status: 422,
          text: jest
            .fn()
            .mockResolvedValueOnce(
              'insufficient balance to fund the transaction'
            ),
        })
      )
    })

    it('should increment both service errors and no-balance metrics', async () => {
      await expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_service_errors_openzeppelin'
      )
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_no_balance_transactions_openzeppelin'
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

  describe('and the relayer responds with success=false carrying a balance error message', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(
        createResponse({
          json: jest.fn().mockResolvedValueOnce({
            success: false,
            data: null,
            error: 'no available token balance to relay',
          }),
        })
      )
    })

    it('should increment both service errors and no-balance metrics', async () => {
      await expect(
        openzeppelin.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_service_errors_openzeppelin'
      )
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_no_balance_transactions_openzeppelin'
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

      it('should increment the reverted transactions metric', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(2000)
        await expect(promise).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_reverted_transactions_openzeppelin'
        )
      })
    })

    describe('and polling the transaction returns a cancelled status without a balance reason', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          createResponse({
            json: jest.fn().mockResolvedValueOnce({
              success: true,
              data: {
                id: 'oz-tx-id',
                hash: null,
                status: 'cancelled',
                status_reason: 'user requested cancellation',
              },
              error: null,
            }),
          })
        )
      })

      it('should increment only the cancelled transactions metric', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(2000)
        await expect(promise).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_cancelled_transactions_openzeppelin'
        )
        expect(metrics.increment).not.toHaveBeenCalledWith(
          'dcl_error_no_balance_transactions_openzeppelin'
        )
      })
    })

    describe('and polling the transaction returns a cancelled status with a balance reason', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          createResponse({
            json: jest.fn().mockResolvedValueOnce({
              success: true,
              data: {
                id: 'oz-tx-id',
                hash: null,
                status: 'cancelled',
                status_reason: 'insufficient balance to relay transaction',
              },
              error: null,
            }),
          })
        )
      })

      it('should increment both the cancelled and no-balance metrics', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(2000)
        await expect(promise).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_cancelled_transactions_openzeppelin'
        )
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_no_balance_transactions_openzeppelin'
        )
      })
    })

    describe('and polling the transaction returns a failed status with a balance reason', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          createResponse({
            json: jest.fn().mockResolvedValueOnce({
              success: true,
              data: {
                id: 'oz-tx-id',
                hash: null,
                status: 'failed',
                status_reason: 'insufficient funds for gas',
              },
              error: null,
            }),
          })
        )
      })

      it('should increment only the no-balance metric', async () => {
        const promise = openzeppelin.sendMetaTransaction(transactionData)
        promise.catch(() => undefined)
        await jest.advanceTimersByTimeAsync(2000)
        await expect(promise).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_no_balance_transactions_openzeppelin'
        )
        expect(metrics.increment).not.toHaveBeenCalledWith(
          'dcl_error_reverted_transactions_openzeppelin'
        )
        expect(metrics.increment).not.toHaveBeenCalledWith(
          'dcl_error_service_errors_openzeppelin'
        )
      })
    })

    describe('and polling the transaction returns an invalid status with an unmapped reason', () => {
      beforeEach(() => {
        fetchMock.mockResolvedValueOnce(
          createResponse({
            json: jest.fn().mockResolvedValueOnce({
              success: true,
              data: {
                id: 'oz-tx-id',
                hash: null,
                status: 'invalid',
                status_reason: 'something unexpected',
              },
              error: null,
            }),
          })
        )
      })

      it('should fall back to the service errors metric', async () => {
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

describe('when tracking retries for an OpenZeppelin transaction', () => {
  const TX_ID = 'oz-tx-id'
  const FIRST_HASH = '0xfirstHash'
  const TX_DETAIL_ENDPOINT = `${TX_ENDPOINT}/${TX_ID}`

  function postResponseWithHash(hash: string | null) {
    return createResponse({
      json: jest.fn().mockResolvedValueOnce({
        success: true,
        data: {
          id: TX_ID,
          hash,
          status: 'submitted',
          status_reason: null,
        },
        error: null,
      }),
    })
  }

  function pollResponse(data: {
    hash?: string | null
    status?: string
    status_reason?: string | null
    nonce?: number
    confirmed_at?: string | null
  }) {
    return createResponse({
      json: jest.fn().mockResolvedValueOnce({
        success: true,
        data: {
          id: TX_ID,
          hash: data.hash ?? null,
          status: data.status ?? 'submitted',
          status_reason: data.status_reason ?? null,
          ...(data.nonce !== undefined ? { nonce: data.nonce } : {}),
          ...(data.confirmed_at !== undefined
            ? { confirmed_at: data.confirmed_at }
            : {}),
        },
        error: null,
      }),
    })
  }

  describe('and the relayer reports two new hashes before confirming on chain', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(postResponseWithHash(FIRST_HASH))
      fetchMock.mockResolvedValueOnce(pollResponse({ hash: '0xsecondHash' }))
      fetchMock.mockResolvedValueOnce(pollResponse({ hash: '0xthirdHash' }))
      fetchMock.mockResolvedValueOnce(
        pollResponse({
          hash: '0xthirdHash',
          confirmed_at: '2026-01-01T00:00:00Z',
        })
      )
    })

    it('should observe the retries histogram with the count of distinct hashes minus one', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      await jest.advanceTimersByTimeAsync(5000 * 3)
      expect(metrics.observe).toHaveBeenCalledWith(
        'dcl_oz_transaction_retries',
        {},
        2
      )
    })

    it('should poll the transaction detail endpoint with the bearer token', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      await jest.advanceTimersByTimeAsync(5000)
      expect(fetchMock).toHaveBeenCalledWith(
        TX_DETAIL_ENDPOINT,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer api-key',
          }),
        })
      )
    })
  })

  describe('and the relayer keeps reporting the same hash', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(postResponseWithHash(FIRST_HASH))
      fetchMock.mockResolvedValue(
        pollResponse({
          hash: FIRST_HASH,
          confirmed_at: '2026-01-01T00:00:00Z',
        })
      )
    })

    it('should observe zero retries', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      await jest.advanceTimersByTimeAsync(5000)
      expect(metrics.observe).toHaveBeenCalledWith(
        'dcl_oz_transaction_retries',
        {},
        0
      )
    })
  })

  describe('and the relayer settles into a terminal failed status', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(postResponseWithHash(FIRST_HASH))
      fetchMock.mockResolvedValueOnce(
        pollResponse({ hash: '0xreplaced', status: 'failed' })
      )
    })

    it('should stop polling and observe one retry', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      await jest.advanceTimersByTimeAsync(5000)
      expect(metrics.observe).toHaveBeenCalledWith(
        'dcl_oz_transaction_retries',
        {},
        1
      )
      const callsBeforeStop = fetchMock.mock.calls.length
      await jest.advanceTimersByTimeAsync(5000 * 5)
      expect(fetchMock.mock.calls.length).toBe(callsBeforeStop)
    })
  })

  describe('and the same nonce is observed across polls', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(postResponseWithHash(FIRST_HASH))
      fetchMock.mockResolvedValueOnce(
        pollResponse({ hash: '0xsecondHash', nonce: 42 })
      )
      fetchMock.mockResolvedValueOnce(
        pollResponse({
          hash: '0xthirdHash',
          nonce: 42,
          confirmed_at: '2026-01-01T00:00:00Z',
        })
      )
    })

    it('should keep counting hashes as retries', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      await jest.advanceTimersByTimeAsync(5000 * 2)
      expect(metrics.observe).toHaveBeenCalledWith(
        'dcl_oz_transaction_retries',
        {},
        2
      )
    })
  })

  describe('and the nonce changes across polls', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(postResponseWithHash(FIRST_HASH))
      fetchMock.mockResolvedValueOnce(
        pollResponse({ hash: '0xsecondHash', nonce: 42 })
      )
      fetchMock.mockResolvedValueOnce(
        pollResponse({ hash: '0xthirdHash', nonce: 99 })
      )
    })

    it('should stop tracking with the retries observed up to that point', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      await jest.advanceTimersByTimeAsync(5000 * 2)
      expect(metrics.observe).toHaveBeenCalledWith(
        'dcl_oz_transaction_retries',
        {},
        1
      )
    })
  })

  describe('and the retry count crosses the warn threshold', () => {
    let logger: { warn: jest.Mock; error: jest.Mock; info: jest.Mock }

    beforeEach(async () => {
      logger = {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      }
      logs = {
        getLogger: () =>
          ({
            ...logger,
            log: jest.fn(),
            debug: jest.fn(),
          } as ReturnType<ILoggerComponent['getLogger']>),
      } as ILoggerComponent
      ;(config.getNumber as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'OZ_RETRY_WARN_THRESHOLD') return 2
          if (key === 'OZ_RETRY_ALERT_THRESHOLD') return 4
          return undefined
        }
      )
      openzeppelin = await createOpenZeppelinComponent({
        config,
        logs,
        metrics,
        fetcher,
      })
      fetchMock.mockResolvedValueOnce(postResponseWithHash(FIRST_HASH))
      fetchMock.mockResolvedValueOnce(pollResponse({ hash: '0xb' }))
      fetchMock.mockResolvedValueOnce(
        pollResponse({
          hash: '0xc',
          confirmed_at: '2026-01-01T00:00:00Z',
        })
      )
    })

    it('should log a warning naming the threshold', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      await jest.advanceTimersByTimeAsync(5000 * 2)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`${TX_ID} hit 2 retries`)
      )
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('hit 4 retries')
      )
    })
  })

  describe('and the retry count crosses the alert threshold', () => {
    let logger: { warn: jest.Mock; error: jest.Mock; info: jest.Mock }

    beforeEach(async () => {
      logger = {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      }
      logs = {
        getLogger: () =>
          ({
            ...logger,
            log: jest.fn(),
            debug: jest.fn(),
          } as ReturnType<ILoggerComponent['getLogger']>),
      } as ILoggerComponent
      ;(config.getNumber as jest.Mock).mockImplementation(
        async (key: string) => {
          if (key === 'OZ_RETRY_WARN_THRESHOLD') return 1
          if (key === 'OZ_RETRY_ALERT_THRESHOLD') return 2
          return undefined
        }
      )
      openzeppelin = await createOpenZeppelinComponent({
        config,
        logs,
        metrics,
        fetcher,
      })
      fetchMock.mockResolvedValueOnce(postResponseWithHash(FIRST_HASH))
      fetchMock.mockResolvedValueOnce(pollResponse({ hash: '0xb' }))
      fetchMock.mockResolvedValueOnce(
        pollResponse({
          hash: '0xc',
          confirmed_at: '2026-01-01T00:00:00Z',
        })
      )
    })

    it('should log an error naming the alert threshold', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      await jest.advanceTimersByTimeAsync(5000 * 2)
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`${TX_ID} hit 2 retries`)
      )
    })
  })

  describe('and a poll request rejects with a network error', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(postResponseWithHash(FIRST_HASH))
      fetchMock.mockRejectedValueOnce(new Error('connection reset'))
      fetchMock.mockResolvedValueOnce(
        pollResponse({
          hash: '0xrecovered',
          confirmed_at: '2026-01-01T00:00:00Z',
        })
      )
    })

    it('should swallow the error and keep polling on the next tick', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      await jest.advanceTimersByTimeAsync(5000 * 2)
      expect(metrics.observe).toHaveBeenCalledWith(
        'dcl_oz_transaction_retries',
        {},
        1
      )
    })
  })

  describe('and the hash never changes nor settles', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(postResponseWithHash(FIRST_HASH))
      fetchMock.mockResolvedValue(pollResponse({ hash: FIRST_HASH }))
    })

    it('should stop tracking after the configured TTL', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      await jest.advanceTimersByTimeAsync(1800000)
      expect(metrics.observe).toHaveBeenCalledWith(
        'dcl_oz_transaction_retries',
        {},
        0
      )
    })
  })

  describe('and sendMetaTransaction has just returned the first hash', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValueOnce(postResponseWithHash(FIRST_HASH))
      fetchMock.mockResolvedValue(pollResponse({ hash: FIRST_HASH }))
    })

    it('should not have observed the retries histogram yet', async () => {
      await openzeppelin.sendMetaTransaction(transactionData)
      expect(metrics.observe).not.toHaveBeenCalled()
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
