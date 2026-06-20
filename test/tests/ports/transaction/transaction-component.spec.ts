import { IFetchComponent } from '@dcl/core-commons'
import {
  IConfigComponent,
  ILoggerComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { IPgComponent } from '@dcl/pg-component'
import { IFeaturesComponent } from '@dcl/features-component'
import { metricDeclarations } from '../../../../src/metrics'
import { IContractsComponent } from '../../../../src/ports/contracts/types'
import { createTransactionComponent } from '../../../../src/ports/transaction/component'
import { ITransactionComponent } from '../../../../src/ports/transaction/types'
import { IRelayRouterComponent } from '../../../../src/ports/relay-router/types'
import { QuotaReachedError } from '../../../../src/types/transactions/errors'
import { TransactionData } from '../../../../src/types/transactions/transactions'

let transaction: ITransactionComponent
let fetcher: IFetchComponent
let metrics: IMetricsComponent<keyof typeof metricDeclarations>
let config: IConfigComponent
let logs: ILoggerComponent
let relayer: IRelayRouterComponent
let transactionData: TransactionData
let contracts: IContractsComponent
let pg: IPgComponent
let features: IFeaturesComponent
let mockedGetIsFeatureEnabled: jest.Mock
let mockedRelayerSendMetaTransaction: jest.Mock
let mockedQuery: jest.Mock
let mockedRequireNumber: jest.Mock
let clientQueryMock: jest.Mock
let clientReleaseMock: jest.Mock
let getPoolMock: jest.Mock

beforeEach(() => {
  fetcher = {} as IFetchComponent
  logs = {} as ILoggerComponent
  mockedGetIsFeatureEnabled = jest.fn()
  mockedRelayerSendMetaTransaction = jest.fn()
  mockedQuery = jest.fn()
  mockedRequireNumber = jest.fn()
  clientQueryMock = jest.fn()
  clientReleaseMock = jest.fn()
  getPoolMock = jest.fn().mockReturnValue({
    connect: jest.fn().mockResolvedValue({
      query: clientQueryMock,
      release: clientReleaseMock,
    }),
  })
  transactionData = { from: '0x1', params: ['1', '2'] }
  config = {
    requireNumber: mockedRequireNumber,
    requireString: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
  }
  relayer = {
    sendMetaTransaction: mockedRelayerSendMetaTransaction,
    getNetworkGasPrice: jest.fn(),
    resolveProvider: jest
      .fn()
      .mockResolvedValue({ name: 'gelato', provider: {} }),
    getRelayerAddresses: jest.fn().mockResolvedValue(new Set<string>()),
  }
  contracts = {} as IContractsComponent
  pg = {
    query: mockedQuery,
    start: jest.fn(),
    stop: jest.fn(),
    streamQuery: jest.fn(),
    withTransaction: jest.fn(),
    withAsyncContextTransaction: jest.fn(),
    getPool: getPoolMock,
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
    relayer,
    pg,
    contracts,
    features,
  })
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('when sending a transaction', () => {
  let txHash: string

  beforeEach(() => {
    txHash = '0xabc'
    mockedGetIsFeatureEnabled.mockResolvedValueOnce(true)
  })

  describe('and the request is successful', () => {
    beforeEach(() => {
      mockedRelayerSendMetaTransaction.mockResolvedValueOnce(txHash)
    })

    it('should send the transaction using the relayer and resolve with its result', async () => {
      await expect(
        transaction.sendMetaTransaction(transactionData)
      ).resolves.toEqual(txHash)
      expect(relayer.sendMetaTransaction).toHaveBeenCalledWith(transactionData)
    })
  })

  describe('and the request fails with an error', () => {
    let error: Error
    beforeEach(() => {
      error = new Error('Failed to send transaction')
      mockedRelayerSendMetaTransaction.mockRejectedValueOnce(error)
    })

    it('should reject with the error', async () => {
      await expect(
        transaction.sendMetaTransaction(transactionData)
      ).rejects.toEqual(error)
    })
  })
})

describe('when reserving a quota slot', () => {
  let userAddress: string
  let sessionId: string

  // The reserve flow runs as a single explicit transaction:
  //   BEGIN; pg_advisory_xact_lock; SELECT COUNT; INSERT or ROLLBACK; COMMIT.
  // Mock the client.query call sequence by returning the supplied count for
  // the third call (the COUNT query).
  function mockReserveSequence(count: number): void {
    clientQueryMock
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
      .mockResolvedValueOnce({ rows: [{ count: String(count) }] })
      .mockResolvedValueOnce(undefined) // INSERT or ROLLBACK
      .mockResolvedValueOnce(undefined) // COMMIT (success path only)
  }

  beforeEach(() => {
    userAddress = '0xabc'
    sessionId = 'session-1'
  })

  describe('and the user is under the daily limit', () => {
    beforeEach(() => {
      mockedRequireNumber.mockResolvedValueOnce(100)
      mockReserveSequence(1)
    })

    it('should not throw an error', async () => {
      await expect(
        transaction.reserveQuota(userAddress, sessionId)
      ).resolves.not.toThrow()
    })

    it('should acquire a per-user advisory lock keyed on the userAddress', async () => {
      await transaction.reserveQuota(userAddress, sessionId)
      expect(clientQueryMock).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [userAddress]
      )
    })

    it('should INSERT a reservation row with user_address and session_id (no tx_hash)', async () => {
      await transaction.reserveQuota(userAddress, sessionId)
      const insertCall = clientQueryMock.mock.calls.find((call) =>
        String(call[0]).startsWith('INSERT')
      )
      expect(insertCall).toBeDefined()
      expect(String(insertCall![0])).toContain('(user_address, session_id)')
      expect(String(insertCall![0])).not.toContain('tx_hash')
      expect(insertCall![1]).toEqual([userAddress, sessionId])
    })

    it('should COMMIT the reserve transaction', async () => {
      await transaction.reserveQuota(userAddress, sessionId)
      expect(clientQueryMock).toHaveBeenCalledWith('COMMIT')
    })

    it('should release the pg client back to the pool', async () => {
      await transaction.reserveQuota(userAddress, sessionId)
      expect(clientReleaseMock).toHaveBeenCalled()
    })
  })

  describe('and the user has reached the daily limit', () => {
    const maxTransactionsPerDay = 2

    beforeEach(() => {
      mockedRequireNumber.mockResolvedValueOnce(maxTransactionsPerDay)
      mockReserveSequence(maxTransactionsPerDay)
    })

    it('should throw a QuotaReachedError', async () => {
      await expect(
        transaction.reserveQuota(userAddress, sessionId)
      ).rejects.toBeInstanceOf(QuotaReachedError)
    })

    it('should ROLLBACK the reserve transaction without inserting', async () => {
      await expect(
        transaction.reserveQuota(userAddress, sessionId)
      ).rejects.toBeInstanceOf(QuotaReachedError)
      expect(clientQueryMock).toHaveBeenCalledWith('ROLLBACK')
      const insertCall = clientQueryMock.mock.calls.find((call) =>
        String(call[0]).startsWith('INSERT')
      )
      expect(insertCall).toBeUndefined()
    })

    it('should release the pg client back to the pool even when the quota throws', async () => {
      await expect(
        transaction.reserveQuota(userAddress, sessionId)
      ).rejects.toBeInstanceOf(QuotaReachedError)
      expect(clientReleaseMock).toHaveBeenCalled()
    })
  })
})

describe('when confirming a reservation', () => {
  let sessionId: string
  let txHash: string

  beforeEach(() => {
    sessionId = 'session-1'
    txHash = '0xdeadbeef'
    mockedQuery.mockResolvedValueOnce(undefined)
  })

  it('should UPDATE the row matching session_id, setting tx_hash and clearing session_id', async () => {
    await transaction.confirmReservation(sessionId, txHash)
    const call = (pg.query as jest.Mock).mock.calls[0][0]
    expect(call.text).toContain('UPDATE transactions')
    expect(call.text).toContain('SET tx_hash =')
    expect(call.text).toContain('session_id = NULL')
    expect(call.text).toContain('WHERE session_id =')
    expect(call.values).toEqual(expect.arrayContaining([txHash, sessionId]))
  })
})

describe('when releasing a reservation', () => {
  let sessionId: string

  beforeEach(() => {
    sessionId = 'session-1'
    mockedQuery.mockResolvedValueOnce(undefined)
  })

  it('should DELETE the row matching session_id', async () => {
    await transaction.releaseReservation(sessionId)
    const call = (pg.query as jest.Mock).mock.calls[0][0]
    expect(call.text).toContain('DELETE FROM transactions')
    expect(call.text).toContain('WHERE session_id =')
    expect(call.values).toEqual(expect.arrayContaining([sessionId]))
  })
})

describe('when getting transactions by user address', () => {
  let userAddress: string

  beforeEach(() => {
    userAddress = '0x1'
  })

  describe('and the request is successful', () => {
    let result: { rows: Array<{ tx_hash: string; user_address: string }> }

    beforeEach(() => {
      result = { rows: [{ tx_hash: '0xabc', user_address: '0x1' }] }
      mockedQuery.mockResolvedValueOnce(result)
    })

    it('should select an explicit column list and filter on tx_hash IS NOT NULL', async () => {
      await expect(transaction.getByUserAddress(userAddress)).resolves.toEqual(
        result
      )
      const call = (pg.query as jest.Mock).mock.calls[0][0]
      expect(call.text).toContain(
        'SELECT id, tx_hash, user_address, created_at'
      )
      expect(call.text).not.toContain('SELECT *')
      expect(call.text).toContain('user_address')
      expect(call.text).toContain('tx_hash IS NOT NULL')
      expect(call.values).toEqual([userAddress])
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
