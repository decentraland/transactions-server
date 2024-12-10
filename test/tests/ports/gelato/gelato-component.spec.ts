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
import { getMetaTxForwarder } from '../../../../src/ports/contracts/MetaTxForwarder'
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
let transactionDataEncoded: string
let mockedFetch: jest.Mock
let chainId: ChainId
let metaTxForwarderContract: ReturnType<typeof getMetaTxForwarder>

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
          return 'https://biconmy.com'
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
  metaTxForwarderContract = getMetaTxForwarder(chainId)
  transactionDataEncoded = encodeFunctionData(
    metaTxForwarderContract.abi,
    'forwardMetaTx',
    transactionData.params
  )
  gelato = await createGelatoComponent({ config, fetcher, metrics, logs })
})

describe('when sending a meta transaction', () => {
  describe('and the response is successful', () => {
    let taskId: string

    beforeEach(() => {
      taskId = 'aTaskId'
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ taskId }),
      })
    })

    describe('and requesting the task id is unsuccessful', () => {
      beforeEach(() => {
        mockedFetch.mockResolvedValueOnce({
          status: 500,
          ok: false,
          headers: {
            get: (key: string) => {
              if (key === 'content-type') {
                return 'application/json'
              }
              throw new Error(`Unknown key: ${key}`)
            },
          },
          json: () => Promise.resolve({ message: 'Internal server error' }),
        })
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

    describe('and requesting the task id results with a execution reverted status', () => {
      beforeEach(() => {
        mockedFetch.mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () =>
            Promise.resolve({
              task: {
                chainId: chainId,
                taskId: 'aTaskId',
                taskState: 'ExecReverted',
                creationDate: '2021-08-31T12:00:00Z',
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

    describe('and requesting the task id results with a cancelled status', () => {
      beforeEach(() => {
        mockedFetch.mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () =>
            Promise.resolve({
              task: {
                chainId: chainId,
                taskId: 'aTaskId',
                taskState: 'Cancelled',
                creationDate: '2021-08-31T12:00:00Z',
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

    describe('and requesting the task id results with a check pending status', () => {
      beforeEach(() => {
        mockedFetch.mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: () =>
            Promise.resolve({
              task: {
                chainId: chainId,
                taskId: 'aTaskId',
                taskState: 'CheckPending',
                creationDate: '2021-08-31T12:00:00Z',
              },
            }),
        })
      })

      describe('and later with a execution pending status', () => {
        beforeEach(() => {
          mockedFetch.mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: () =>
              Promise.resolve({
                task: {
                  chainId: chainId,
                  taskId: 'aTaskId',
                  taskState: 'ExecPending',
                  creationDate: '2021-08-31T12:00:00Z',
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
          expect(mockedFetch).toHaveBeenCalledWith(
            'https://biconmy.com/relays/v2/sponsored-call',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chainId: chainId,
                target: metaTxForwarderContract.address,
                data: transactionDataEncoded,
                sponsorApiKey: 'aKey',
              }),
            }
          )
        })

        it('should have requested the status of the task with the task id retrieved in the request to the relayer', async () => {
          await expect(
            gelato.sendMetaTransaction(transactionData)
          ).resolves.toBe('aTransactionHash')
          expect(mockedFetch).toHaveBeenCalledWith(
            `https://biconmy.com/tasks/status/${taskId}`
          )
        })
      })

      describe('and later with an execution success status', () => {
        beforeEach(() => {
          mockedFetch.mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: () =>
              Promise.resolve({
                task: {
                  chainId: chainId,
                  taskId: 'aTaskId',
                  taskState: 'ExecSuccess',
                  creationDate: '2021-08-31T12:00:00Z',
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

      describe('and later with a waiting for confirmation status', () => {
        beforeEach(() => {
          mockedFetch.mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: () =>
              Promise.resolve({
                task: {
                  chainId: chainId,
                  taskId: 'aTaskId',
                  taskState: 'WaitingForConfirmation',
                  creationDate: '2021-08-31T12:00:00Z',
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
        headers: {
          get: (key: string) => {
            if (key === 'content-type') {
              return 'application/json'
            }
            throw new Error(`Unknown key: ${key}`)
          },
        },
        json: () => Promise.resolve({ message: 'Internal server error' }),
      })
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
