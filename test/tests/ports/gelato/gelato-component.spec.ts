import {
  IConfigComponent,
  ILoggerComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { metricDeclarations } from '@well-known-components/thegraph-component'
import { ChainId } from '@dcl/schemas'
import { ErrorCode } from 'decentraland-transactions'
import {
  TransactionRejectedError,
  TransactionRevertedError,
  InsufficientBalanceRpcError,
} from '@gelatocloud/gasless'
import { createGelatoComponent } from '../../../../src/ports/gelato'
import {
  IMetaTransactionProviderComponent,
  InvalidTransactionError,
  RelayerError,
  TransactionData,
} from '../../../../src/types/transactions'

const mockSendTransaction = jest.fn()
const mockWaitForReceipt = jest.fn()

jest.mock('@gelatocloud/gasless', () => {
  const actual = jest.requireActual('@gelatocloud/gasless')
  return {
    ...actual,
    createGelatoEvmRelayerClient: () => ({
      sendTransaction: mockSendTransaction,
      waitForReceipt: mockWaitForReceipt,
    }),
  }
})

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

let gelato: IMetaTransactionProviderComponent
let metrics: IMetricsComponent<keyof typeof metricDeclarations>
let config: IConfigComponent
let logs: ILoggerComponent
let transactionData: TransactionData
let chainId: ChainId

beforeEach(async () => {
  chainId = ChainId.MATIC_AMOY
  mockSendTransaction.mockReset()
  mockWaitForReceipt.mockReset()
  mockGetGasPrice.mockReset()
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
  gelato = await createGelatoComponent({ config, metrics, logs })
})

describe('when sending a meta transaction', () => {
  describe('and the send transaction is successful', () => {
    let taskId: string

    beforeEach(() => {
      taskId = '0xaTaskId'
      mockSendTransaction.mockResolvedValueOnce(taskId)
    })

    describe('and waiting for receipt succeeds', () => {
      beforeEach(() => {
        mockWaitForReceipt.mockResolvedValueOnce({
          transactionHash: 'aTransactionHash',
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

      it('should have called sendTransaction with the correct parameters', async () => {
        await gelato.sendMetaTransaction(transactionData)
        expect(mockSendTransaction).toHaveBeenCalledWith({
          chainId: chainId,
          to: transactionData.params[0],
          data: transactionData.params[1],
        })
      })

      it('should have called waitForReceipt with the task id', async () => {
        await gelato.sendMetaTransaction(transactionData)
        expect(mockWaitForReceipt).toHaveBeenCalledWith(
          { id: taskId },
          { throwOnReverted: true }
        )
      })
    })

    describe('and waiting for receipt results with a reverted error', () => {
      beforeEach(() => {
        mockWaitForReceipt.mockRejectedValueOnce(
          new TransactionRevertedError({
            id: taskId,
            chainId: chainId,
            createdAt: Date.now(),
            errorData: '0x',
            errorMessage: 'execution reverted',
            receipt: {
              transactionHash: 'aTransactionHash',
            } as any,
          })
        )
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

    describe('and waiting for receipt results with a rejected error', () => {
      beforeEach(() => {
        mockWaitForReceipt.mockRejectedValueOnce(
          new TransactionRejectedError({
            id: taskId,
            chainId: chainId,
            createdAt: Date.now(),
            errorData: undefined,
            errorMessage: 'Transaction rejected',
          })
        )
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

    describe('and waiting for receipt results with a rejected error due to no balance', () => {
      beforeEach(() => {
        mockWaitForReceipt.mockRejectedValueOnce(
          new TransactionRejectedError({
            id: taskId,
            chainId: chainId,
            createdAt: Date.now(),
            errorData: undefined,
            errorMessage: 'No available token balance',
          })
        )
      })

      it('should increment both cancelled and no balance metrics', async () => {
        await expect(
          gelato.sendMetaTransaction(transactionData)
        ).rejects.toThrow()

        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_cancelled_transactions_gelato'
        )
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_no_balance_transactions_gelato'
        )
      })
    })

    describe('and waiting for receipt times out', () => {
      beforeEach(() => {
        mockWaitForReceipt.mockRejectedValueOnce(
          new Error('Timeout waiting for status for transaction 0xaTaskId')
        )
      })

      it('should increment the timeout metric', async () => {
        await expect(
          gelato.sendMetaTransaction(transactionData)
        ).rejects.toThrow()
        expect(metrics.increment).toHaveBeenCalledWith(
          'dcl_error_timeout_gelato'
        )
      })
    })

    describe('and waiting for receipt fails with an unknown error', () => {
      beforeEach(() => {
        mockWaitForReceipt.mockRejectedValueOnce(
          new Error('Unknown error')
        )
      })

      it('should reject with a relayer error', () => {
        return expect(
          gelato.sendMetaTransaction(transactionData)
        ).rejects.toThrow(new RelayerError(500, 'Unknown error'))
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

  describe('and the send transaction is unsuccessful', () => {
    beforeEach(() => {
      mockSendTransaction.mockRejectedValueOnce(
        new Error('Internal server error')
      )
    })

    it('should reject with a relayer error', () => {
      return expect(
        gelato.sendMetaTransaction(transactionData)
      ).rejects.toThrow(new RelayerError(500, 'Internal server error'))
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

  describe('and the send transaction fails due to insufficient balance', () => {
    beforeEach(() => {
      const cause = { code: 4205, message: 'Insufficient balance' } as any
      mockSendTransaction.mockRejectedValueOnce(
        new InsufficientBalanceRpcError(cause)
      )
    })

    it('should increment both service errors and no balance metrics', async () => {
      await expect(
        gelato.sendMetaTransaction(transactionData)
      ).rejects.toThrow()
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_service_errors_gelato'
      )
      expect(metrics.increment).toHaveBeenCalledWith(
        'dcl_error_no_balance_transactions_gelato'
      )
    })
  })
})

describe('when getting the network gas price', () => {
  describe('and retrieving the gas price from the RPC provider is successful', () => {
    beforeEach(() => {
      mockGetGasPrice.mockResolvedValueOnce(20n)
    })

    it('should resolve to a bigint representing the network gas price in wei', () => {
      return expect(gelato.getNetworkGasPrice(chainId)).resolves.toEqual(
        20n
      )
    })
  })

  describe('and retrieving the gas price from the RPC provider is unsuccessful', () => {
    beforeEach(() => {
      mockGetGasPrice.mockRejectedValueOnce(new Error('An error occurred'))
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
