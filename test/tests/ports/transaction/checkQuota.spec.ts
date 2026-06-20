import { IConfigComponent, IDatabase } from '@well-known-components/interfaces'
import { IMetricsComponent, IPgComponent } from '@dcl/pg-component'
import { IContractsComponent } from '../../../../src/ports/contracts/types'
import { IRelayRouterComponent } from '../../../../src/ports/relay-router/types'
import { checkQuota } from '../../../../src/ports/transaction/validation'
import {
  QuotaReachedError,
  TransactionData,
} from '../../../../src/types/transactions'
import { approveMana } from '../../../mocks/transactionData'

let userAddress: string
let transactionData: TransactionData
let requireNumberMock: jest.Mock
let queryMock: jest.Mock
let components: {
  config: IConfigComponent
  pg: IPgComponent
  contracts: IContractsComponent
  metrics: IMetricsComponent
  relayer: IRelayRouterComponent
}

beforeEach(() => {
  requireNumberMock = jest.fn()
  queryMock = jest.fn()

  // Quota is keyed on the userAddress decoded from the meta-tx calldata, not
  // on the JSON `from` field. We use the approveMana mock (a real,
  // decodable executeMetaTransaction payload) so the helper can decode
  // params[1].
  userAddress = '0xf7b0e5d753747f102369cc6f8f33cc3feacf7c62'
  transactionData = approveMana

  components = {
    config: {
      requireNumber: requireNumberMock,
      requireString: jest.fn(),
      getString: jest.fn(),
      getNumber: jest.fn(),
    },
    pg: {
      query: queryMock,
      start: jest.fn(),
      stop: jest.fn(),
      streamQuery: jest.fn(),
      withTransaction: jest.fn(),
      withAsyncContextTransaction: jest.fn(),
      getPool: jest.fn(),
    },
    contracts: {
      isValidAddress: jest.fn(),
      isCollectionAddress: jest.fn(),
      isWhitelisted: jest.fn(),
      getCollectionQuery: jest.fn(),
      clearCache: jest.fn(),
    },
    metrics: {} as IMetricsComponent,
    relayer: {
      sendMetaTransaction: jest.fn(),
      getNetworkGasPrice: jest.fn(),
      resolveProvider: jest.fn(),
      getRelayerAddresses: jest.fn().mockResolvedValue(new Set<string>()),
    },
  }
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('when checking the quota for a user', () => {
  describe('and the user is under the daily limit', () => {
    beforeEach(() => {
      const databaseResult = {
        rows: [{ count: 1 }],
      } as IDatabase.IQueryResult<{ count: number }>
      requireNumberMock.mockResolvedValueOnce(100)
      queryMock.mockResolvedValueOnce(databaseResult)
    })

    it('should not throw an error', async () => {
      await expect(
        checkQuota(components, transactionData)
      ).resolves.not.toThrow()
    })

    it('should issue a single SELECT COUNT keyed on the userAddress', async () => {
      await checkQuota(components, transactionData)
      expect(queryMock).toHaveBeenCalledTimes(1)
      const call = queryMock.mock.calls[0][0]
      expect(call.text).toContain('SELECT COUNT(*)')
      expect(call.text).toContain('user_address')
      expect(call.values).toEqual(expect.arrayContaining([userAddress]))
    })
  })

  describe('and the user has reached the daily limit', () => {
    const maxTransactionsPerDay = 2

    beforeEach(() => {
      const databaseResult = {
        rows: [{ count: maxTransactionsPerDay }],
      } as IDatabase.IQueryResult<{ count: number }>
      requireNumberMock.mockResolvedValueOnce(maxTransactionsPerDay)
      queryMock.mockResolvedValueOnce(databaseResult)
    })

    it('should throw a QuotaReachedError carrying the userAddress and current count', async () => {
      const error = new QuotaReachedError(userAddress, maxTransactionsPerDay)
      await expect(checkQuota(components, transactionData)).rejects.toThrow(
        error.message
      )
    })

    it('should reject with a QuotaReachedError instance', async () => {
      await expect(
        checkQuota(components, transactionData)
      ).rejects.toBeInstanceOf(QuotaReachedError)
    })
  })
})
