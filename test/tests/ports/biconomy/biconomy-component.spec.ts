import { IFetchComponent } from '@well-known-components/http-server'
import {
  IConfigComponent,
  ILoggerComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { ErrorCode } from 'decentraland-transactions'
import { ethers } from 'ethers'
import { metricDeclarations } from '../../../../src/metrics'
import {
  BiconomyMetaTransactionComponent,
  createBiconomyComponent,
  MetaTransactionErrorCode,
  MetaTransactionStatus,
} from '../../../../src/ports/biconomy'
import {
  InvalidTransactionError,
  TransactionData,
} from '../../../../src/types/transactions'

let biconomy: BiconomyMetaTransactionComponent
let fetcher: IFetchComponent
let metrics: IMetricsComponent<keyof typeof metricDeclarations>
let config: IConfigComponent
let logs: ILoggerComponent
let transactionData: TransactionData
let mockedFetch: jest.Mock

beforeEach(() => {
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
        case 'BICONOMY_API_URL':
          return 'https://biconmy.com'
        case 'BICONOMY_API_KEY':
          return 'aKey'
        case 'BICONOMY_API_ID':
          return '1234'
        default:
          throw new Error(`Unknown key: ${key}`)
      }
    },
    requireNumber: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
  } as IConfigComponent
  transactionData = { from: '0x1', params: ['1', '2'] }
  biconomy = createBiconomyComponent({ config, fetcher, metrics, logs })
})

describe('when sending a meta transaction', () => {
  describe('and the response is successful', () => {
    let result: string

    beforeEach(async () => {
      mockedFetch.mockResolvedValueOnce({
        status: MetaTransactionStatus.OK,
        json: () =>
          Promise.resolve({
            txHash: 'METATX',
          }),
      })

      result = await biconomy.sendMetaTransaction(transactionData)
    })

    it('should have relayed the transaction to the biconomy API', () => {
      expect(fetcher.fetch).toHaveBeenCalledWith(
        'https://biconmy.com/api/v2/meta-tx/native',
        {
          headers: {
            'x-api-key': 'aKey',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ apiId: '1234', ...transactionData }),
          method: 'POST',
        }
      )
    })

    it('should respond with the transaction hash', () => {
      expect(result).toEqual('METATX')
    })

    it('should have incremented the sent transactions metrics', () => {
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_sent_transactions_biconomy'
      )
    })
  })

  describe('and the response is unsuccessful with a not found status', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValueOnce({
        status: MetaTransactionStatus.NOT_FOUND,
        text: () => Promise.resolve('Not found'),
        statusText: 'Not found',
      })
    })

    it('should resolve with an error', async () => {
      await expect(
        biconomy.sendMetaTransaction(transactionData)
      ).rejects.toThrow(
        new InvalidTransactionError(
          `An error occurred trying to send the meta transaction. Response: Not found. Not found`,
          undefined
        )
      )
    })

    it('should have incremented the error metrics', async () => {
      await expect(
        biconomy.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_relay_transactions_biconomy'
      )
    })
  })

  describe('and the response is unsuccessful with an internal server error status', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValueOnce({
        status: MetaTransactionStatus.INTERNAL_SERVER_ERROR,
        text: () => Promise.resolve('Internal Error'),
        statusText: 'Internal Error',
      })
    })

    it('should resolve with an error', async () => {
      await expect(
        biconomy.sendMetaTransaction(transactionData)
      ).rejects.toThrow(
        new InvalidTransactionError(
          `An error occurred trying to send the meta transaction. Response: Internal Error. Internal Error`,
          undefined
        )
      )
    })

    it('should have incremented the error metrics', async () => {
      await expect(
        biconomy.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_relay_transactions_biconomy'
      )
    })
  })

  describe('and the response is unsuccessful with a conflict status', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValueOnce({
        status: MetaTransactionStatus.CONFLICT,
        statusText: 'Conflict',
        json: () =>
          Promise.resolve({
            code: MetaTransactionErrorCode.DAPP_LIMIT_REACHED,
            message: 'dApp Limit reached',
          }),
      })
    })

    it('should resolve with an error', async () => {
      await expect(
        biconomy.sendMetaTransaction(transactionData)
      ).rejects.toThrow(
        new InvalidTransactionError(
          `An error occurred trying to send the meta transaction. Response: dApp Limit reached. Conflict`,
          ErrorCode.DAPP_LIMIT_REACHED
        )
      )
    })

    it('should have incremented the error metrics', async () => {
      await expect(
        biconomy.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_limit_reached_transactions_biconomy',
        {
          code: ErrorCode.DAPP_LIMIT_REACHED,
        }
      )
    })
  })

  describe('and the response is unsuccessful with an expectation failed', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValueOnce({
        statusText: 'Expectation Failed',
        status: MetaTransactionStatus.EXPECTATION_FAILED,
        text: () => Promise.resolve('code=UNPREDICTABLE_GAS_LIMIT'),
      })
    })

    it('should resolve with an error', async () => {
      await expect(
        biconomy.sendMetaTransaction(transactionData)
      ).rejects.toThrow(
        new InvalidTransactionError(
          `An error occurred trying to send the meta transaction. Response: code=UNPREDICTABLE_GAS_LIMIT. Expectation Failed`,
          ErrorCode.EXPECTATION_FAILED
        )
      )
    })

    it('should have incremented the error metrics', async () => {
      await expect(
        biconomy.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_cannot_estimate_gas_transactions_biconomy'
      )
    })
  })

  describe('and the response is unsuccessful with a not handled status', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValueOnce({
        statusText: 'Gateway Timeout',
        status: 504,
        text: () => Promise.resolve('Gateway Timeout'),
      })
    })

    it('should resolve with an error', async () => {
      await expect(
        biconomy.sendMetaTransaction(transactionData)
      ).rejects.toThrow(
        new InvalidTransactionError(
          `An error occurred trying to send the meta transaction. Response: Gateway Timeout. Gateway Timeout`,
          undefined
        )
      )
    })
  })
})

describe('when getting the network gas price', () => {
  describe('and the response is successful', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            gasPrice: {
              value: 1,
              unit: 'gwei',
            },
          }),
      })
    })

    it('should resolve to a big number representing the network gas price in wei', () => {
      return expect(biconomy.getNetworkGasPrice(80002)).resolves.toEqual(
        ethers.BigNumber.from(1000000000)
      )
    })
  })

  describe('and the response is unsuccessful', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
      })
    })

    it('should resolve to null', () => {
      return expect(biconomy.getNetworkGasPrice(80002)).resolves.toBeNull()
    })
  })
})
