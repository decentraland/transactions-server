import { IFetchComponent } from '@well-known-components/http-server'
import {
  IConfigComponent,
  ILoggerComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { IPgComponent } from '@well-known-components/pg-component'
import { IFeaturesComponent } from '@well-known-components/features-component/dist/types'
import { metricDeclarations } from '../../../../src/metrics'
import { IContractsComponent } from '../../../../src/ports/contracts/types'
import { GelatoMetaTransactionComponent } from '../../../../src/ports/gelato'
import { createTransactionComponent } from '../../../../src/ports/transaction/component'
import { ITransactionComponent } from '../../../../src/ports/transaction/types'
import { TransactionData } from '../../../../src/types/transactions'

let transaction: ITransactionComponent
let fetcher: IFetchComponent
let metrics: IMetricsComponent<keyof typeof metricDeclarations>
let config: IConfigComponent
let logs: ILoggerComponent
let gelato: GelatoMetaTransactionComponent
let transactionData: TransactionData
let contracts: IContractsComponent
let pg: IPgComponent
let features: IFeaturesComponent
let mockedGetIsFeatureEnabled: jest.Mock
let mockedGelatoSendMetaTransaction: jest.Mock
let mockedQuery: jest.Mock

beforeEach(() => {
  fetcher = {} as IFetchComponent
  logs = {} as ILoggerComponent
  config = {} as IConfigComponent
  mockedGetIsFeatureEnabled = jest.fn()
  mockedGelatoSendMetaTransaction = jest.fn()
  mockedQuery = jest.fn()
  transactionData = { from: '0x1', params: ['1', '2'] }
  gelato = {
    sendMetaTransaction: mockedGelatoSendMetaTransaction,
    getNetworkGasPrice: jest.fn(),
  }
  contracts = {} as IContractsComponent
  pg = {
    query: mockedQuery,
    start: jest.fn(),
    stop: jest.fn(),
    streamQuery: jest.fn(),
    getPool: jest.fn(),
  }
  features = {
    getIsFeatureEnabled: mockedGetIsFeatureEnabled,
    getEnvFeature: jest.fn(),
    getFeatureVariant: jest.fn(),
  }

  transaction = createTransactionComponent({
    config,
    fetcher,
    metrics,
    logs,
    gelato,
    pg,
    contracts,
    features,
  })
})

describe('when sending a transaction', () => {
  let txHash: string

  beforeEach(() => {
    mockedGetIsFeatureEnabled.mockResolvedValueOnce(true)
  })

  describe('and the request is successful', () => {
    beforeEach(() => {
      mockedGelatoSendMetaTransaction.mockResolvedValueOnce(txHash)
    })

    it('should send the transaction using gelato and resolve with its result', async () => {
      await expect(
        transaction.sendMetaTransaction(transactionData)
      ).resolves.toEqual(txHash)
      expect(gelato.sendMetaTransaction).toHaveBeenCalledWith(transactionData)
    })
  })

  describe('and the request fails with an error', () => {
    let error: Error
    beforeEach(() => {
      error = new Error('Failed to send transaction')
      mockedGelatoSendMetaTransaction.mockRejectedValueOnce(error)
    })

    it('should reject with the error', async () => {
      await expect(
        transaction.sendMetaTransaction(transactionData)
      ).rejects.toEqual(error)
    })
  })
})

describe('when inserting a transaction', () => {
  let row: { tx_hash: string; user_address: string }

  beforeEach(() => {
    row = { tx_hash: '0x1', user_address: '0x2' }
  })

  describe('and the request is successful', () => {
    beforeEach(() => {
      mockedQuery.mockResolvedValueOnce(undefined)
    })

    it('should insert the transaction into the database and resolve', async () => {
      await transaction.insert(row)
      expect(pg.query).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining('INSERT INTO transactions'),
          ]),
          values: expect.arrayContaining([row.tx_hash, row.user_address]),
        })
      )
    })
  })

  describe('and the request fails with an error', () => {
    let error: Error

    beforeEach(() => {
      error = new Error('Failed to insert transaction')
      mockedQuery.mockRejectedValueOnce(error)
    })

    it('should reject with the error', () => {
      return expect(transaction.insert(row)).rejects.toEqual(error)
    })
  })
})

describe('when getting transactions by user address', () => {
  let userAddress: string

  beforeEach(() => {
    userAddress = '0x1'
  })

  describe('and the request is successful', () => {
    let result: any

    beforeEach(() => {
      result = { rows: [{ tx_hash: '0x1', user_address: '0x2' }] }
      mockedQuery.mockResolvedValueOnce(result)
    })

    it('should resolve with the transactions from the database', async () => {
      await expect(transaction.getByUserAddress(userAddress)).resolves.toEqual(
        result
      )
      expect(pg.query).toHaveBeenCalledWith(
        expect.objectContaining({
          strings: expect.arrayContaining([
            expect.stringContaining(
              'SELECT * FROM transactions WHERE user_address ='
            ),
          ]),
          values: [userAddress],
        })
      )
    })
  })

  describe('and the request fails with an error', () => {
    let error: Error

    beforeEach(() => {
      error = new Error('Failed to get transactions')
      mockedQuery.mockRejectedValueOnce(error)
    })

    it('should reject with the error', () => {
      return expect(transaction.getByUserAddress(userAddress)).rejects.toEqual(
        error
      )
    })
  })
})
