import { IConfigComponent, IDatabase } from '@well-known-components/interfaces'
import { IPgComponent } from '@well-known-components/pg-component'
import { checkQuota } from '../../../../src/ports/transaction/validation'
import {
  QuotaReachedError,
  TransactionData,
} from '../../../../src/types/transactions'

let from: string
let transactionData: TransactionData
let requiredNumberMock: jest.Mock
let queryMock: jest.Mock
let components: {
  config: IConfigComponent
  pg: IPgComponent
}

beforeEach(() => {
  requiredNumberMock = jest.fn()
  queryMock = jest.fn()
  from = '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b'
  transactionData = {
    from,
    params: ['', ''],
  }
  components = {
    config: {
      requireNumber: requiredNumberMock,
      requireString: jest.fn(),
      getString: jest.fn(),
      getNumber: jest.fn(),
    },
    pg: {
      query: queryMock,
      start: jest.fn(),
      stop: jest.fn(),
      streamQuery: jest.fn(),
      getPool: jest.fn(),
    },
  }
})

describe('when checking the quota for a new address', () => {
  beforeEach(() => {
    const databaseResult = {
      rows: [{ count: 1 }],
    } as IDatabase.IQueryResult<{
      count: number
    }>
    requiredNumberMock.mockResolvedValueOnce(100)
    queryMock.mockResolvedValueOnce(databaseResult)
  })

  it('should not throw an error', async () => {
    await expect(checkQuota(components, transactionData)).resolves.not.toThrow()
  })
})

describe('when the quota limit is reached for a single day', () => {
  const maxTransactionsPerDay = 2

  beforeEach(() => {
    const databaseResult = {
      rows: [{ count: maxTransactionsPerDay }],
    } as IDatabase.IQueryResult<{
      count: number
    }>

    requiredNumberMock.mockResolvedValueOnce(maxTransactionsPerDay)
    queryMock.mockResolvedValueOnce(databaseResult)
  })

  it('should throw an error signaling that the quota was reached', async () => {
    const error = new QuotaReachedError(from, maxTransactionsPerDay)

    await expect(checkQuota(components, transactionData)).rejects.toThrow(
      error.message
    )
  })
})
