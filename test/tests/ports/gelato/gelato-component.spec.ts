import { IFetchComponent } from '@well-known-components/http-server'
import {
  IConfigComponent,
  ILoggerComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { metricDeclarations } from '@well-known-components/thegraph-component'
import { ChainId } from '@dcl/schemas'
import { ErrorCode } from 'decentraland-transactions'
import { ethers } from 'ethers'
import { encodeFunctionData } from '../../../../src/logic/ethereum'
import { createGelatoComponent } from '../../../../src/ports/gelato'
import {
  IMetaTransactionProviderComponent,
  InvalidTransactionError,
  RelayerError,
  TransactionData,
} from '../../../../src/types/transactions'

let gelato: IMetaTransactionProviderComponent
let fetcher: IFetchComponent
let metrics: IMetricsComponent<keyof typeof metricDeclarations>
let config: IConfigComponent
let logs: ILoggerComponent
let transactionData: TransactionData
let mockedFetch: jest.Mock
let chainId: ChainId

beforeEach(async () => {
  chainId = ChainId.MATIC_AMOY
  mockedFetch = jest.fn()
  logs = {
    getLogger: () => ({
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
    }),
  } as ILoggerComponent
  fetcher = {
    fetch: mockedFetch,
  } as IFetchComponent
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
        case 'GELATO_API_URL':
          return 'https://api.gelato.cloud'
        case 'GELATO_API_KEY':
          return 'aKey'
        case 'RPC_URL':
          return 'https://rpc.com'
        default:
          throw new Error(`Unknown key: ${key}`)
      }
    },
    requireNumber: async (key: string) => {
      switch (key) {
        case 'COLLECTIONS_CHAIN_ID':
          return chainId
        case 'GELATO_MAX_STATUS_CHECKS':
          return 150
        case 'GELATO_SLEEP_TIME_BETWEEN_CHECKS':
          return 800
        default:
          throw new Error(`Unknown key: ${key}`)
      }
    },
    getString: jest.fn(),
    getNumber: jest.fn(),
  } as IConfigComponent
  transactionData = {
    from: '0x1234567890abcdef1234567890abcdef12345678',
    params: [
      '0x2a39d4f68133491f0442496f601cde2a945b6d31',
      '0x' + Buffer.from('mock data').toString('hex'),
    ],
  }
  gelato = await createGelatoComponent({ config, fetcher, metrics, logs })
})

const rpcUrl = 'https://api.gelato.cloud/rpc'
const rpcHeaders = {
  'Content-Type': 'application/json',
  'X-API-Key': 'aKey',
}

describe('when sending a meta transaction', () => {
  describe('and the response is successful', () => {
    let taskId: string

    beforeEach(() => {
      taskId = 'aTaskId'
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 1,
            result: taskId,
          }),
      })
    })

    describe('and requesting the task id is unsuccessful', () => {
      beforeEach(() => {
        mockedFetch.mockResolvedValueOnce({
          status: 500,
          ok: false,
          json: () => Promise.resolve({ message: 'Internal server error' }),
        })
      })

      it('should reject with a relayer error', () => {
        return expect(
          gelato.sendMetaTransaction(transactionData)
        ).rejects.toThrow(RelayerError)
      })

      it('should increment the service errors metric', async () => {
        await expect(
          gelato.sendMetaTransaction(transactionData)
        ).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_service_errors_gelato'
        )
      })
    })

    describe('and requesting the task id results with a reverted status', () => {
      beforeEach(() => {
        mockedFetch.mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: '2.0',
              id: 1,
              result: {
                chainId: chainId,
                createdAt: 1630411200,
                status: 500,
                error: 'execution reverted',
              },
            }),
        })
      })

      it('should reject with an invalid transaction error', () => {
        return expect(
          gelato.sendMetaTransaction(transactionData)
        ).rejects.toThrow(
          new InvalidTransactionError(
            'Transaction reverted',
            ErrorCode.EXPECTATION_FAILED
          )
        )
      })

      it('should increment the reverted transactions metric', async () => {
        await expect(
          gelato.sendMetaTransaction(transactionData)
        ).rejects.toThrow()

        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_reverted_transactions_gelato'
        )
      })
    })

    describe('and requesting the task id results with a rejected status', () => {
      beforeEach(() => {
        mockedFetch.mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: '2.0',
              id: 1,
              result: {
                chainId: chainId,
                createdAt: 1630411200,
                status: 400,
                error: 'task rejected',
              },
            }),
        })
      })

      it('should reject with an invalid transaction error', () => {
        return expect(
          gelato.sendMetaTransaction(transactionData)
        ).rejects.toThrow(
          new InvalidTransactionError(
            'Transaction cancelled',
            ErrorCode.EXPECTATION_FAILED
          )
        )
      })

      it('should increment the cancelled transactions metric', async () => {
        await expect(
          gelato.sendMetaTransaction(transactionData)
        ).rejects.toThrow()

        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_cancelled_transactions_gelato'
        )
      })
    })

    describe('and requesting the task id results with a pending status', () => {
      beforeEach(() => {
        mockedFetch.mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: '2.0',
              id: 1,
              result: {
                chainId: chainId,
                createdAt: 1630411200,
                status: 100,
              },
            }),
        })
      })

      describe('and later with a submitted status', () => {
        beforeEach(() => {
          mockedFetch.mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: () =>
              Promise.resolve({
                jsonrpc: '2.0',
                id: 1,
                result: {
                  chainId: chainId,
                  createdAt: 1630411200,
                  status: 110,
                  transactionHash: 'aTransactionHash',
                },
              }),
          })
        })

        it('should return the transaction hash', () => {
          return expect(
            gelato.sendMetaTransaction(transactionData)
          ).resolves.toBe('aTransactionHash')
        })

        it('should increment the sent transactions metric', async () => {
          await gelato.sendMetaTransaction(transactionData)
          expect(metrics.increment).toHaveBeenCalledWith(
            'dcl_sent_transactions_gelato'
          )
        })

        it('should have requested the relayer with the transaction data', async () => {
          await expect(
            gelato.sendMetaTransaction(transactionData)
          ).resolves.toBe('aTransactionHash')
          expect(mockedFetch).toHaveBeenCalledWith(rpcUrl, {
            method: 'POST',
            headers: rpcHeaders,
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'relayer_sendTransaction',
              id: 1,
              params: {
                chainId: String(chainId),
                to: transactionData.params[0],
                data: transactionData.params[1],
                payment: { type: 'sponsored' },
              },
            }),
          })
        })

        it('should have requested the status of the task with the task id retrieved in the request to the relayer', async () => {
          await expect(
            gelato.sendMetaTransaction(transactionData)
          ).resolves.toBe('aTransactionHash')
          expect(mockedFetch).toHaveBeenCalledWith(rpcUrl, {
            method: 'POST',
            headers: rpcHeaders,
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'relayer_getStatus',
              id: 1,
              params: {
                id: taskId,
                logs: false,
              },
            }),
          })
        })
      })

      describe('and later with an included status', () => {
        beforeEach(() => {
          mockedFetch.mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: () =>
              Promise.resolve({
                jsonrpc: '2.0',
                id: 1,
                result: {
                  chainId: chainId,
                  createdAt: 1630411200,
                  status: 200,
                  transactionHash: 'aTransactionHash',
                },
              }),
          })
        })

        it('should return the transaction hash', () => {
          return expect(
            gelato.sendMetaTransaction(transactionData)
          ).resolves.toBe('aTransactionHash')
        })

        it('should increment the sent transactions metric', async () => {
          await gelato.sendMetaTransaction(transactionData)
          expect(metrics.increment).toHaveBeenCalledWith(
            'dcl_sent_transactions_gelato'
          )
        })
      })
    })
  })

  describe('and the response is unsuccessful', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValueOnce({
        status: 500,
        ok: false,
        json: () => Promise.resolve({ message: 'Internal server error' }),
      })
    })

    it('should reject with a relayer error', () => {
      return expect(
        gelato.sendMetaTransaction(transactionData)
      ).rejects.toThrow(RelayerError)
    })

    it('should increment the service errors metric', async () => {
      await expect(
        gelato.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_service_errors_gelato'
      )
    })
  })

  describe('and the response contains a JSON-RPC error', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: -32602,
              message: 'Invalid params',
            },
          }),
      })
    })

    it('should reject with a relayer error', () => {
      return expect(
        gelato.sendMetaTransaction(transactionData)
      ).rejects.toThrow(RelayerError)
    })

    it('should increment the service errors metric', async () => {
      await expect(
        gelato.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_service_errors_gelato'
      )
    })
  })
})

describe('when getting the network gas price', () => {
  let spiedProvider: jest.SpyInstance

  beforeEach(() => {
    spiedProvider = jest.spyOn(
      ethers.providers.JsonRpcProvider.prototype,
      'getGasPrice'
    )
  })

  describe('and retrieving the gas price from the RPC provider is successful', () => {
    beforeEach(() => {
      spiedProvider.mockResolvedValueOnce(ethers.BigNumber.from(20))
    })

    it('should resolve to a big number representing the network gas price in wei', () => {
      return expect(gelato.getNetworkGasPrice(chainId)).resolves.toEqual(
        ethers.BigNumber.from(20)
      )
    })
  })

  describe('and retrieving the gas price from the RPC provider is unsuccessful', () => {
    beforeEach(() => {
      spiedProvider.mockRejectedValueOnce(new Error('An error occurred'))
    })

    it('should resolve to null', () => {
      return expect(gelato.getNetworkGasPrice(chainId)).resolves.toBeNull()
    })
  })
})

describe('when gas price exceeds the allowed limit', () => {
  it('should have the high gas price metric available', () => {
    expect(metrics.increment).toBeDefined()
  })

  it('should be able to increment the high gas price metric with gas price values', () => {
    metrics.increment('dcl_error_high_gas_price_gelato')

    expect(metrics.increment).toHaveBeenCalledWith(
      'dcl_error_high_gas_price_gelato'
    )
  })
})
