import { IDatabase } from '@well-known-components/interfaces'
import { checkQuota } from '../../../../src/ports/transaction/validation'
import {
  QuotaReachedError,
  TransactionData,
} from '../../../../src/types/transactions'
import { test } from '../../../components'

test('checkQuota component', function ({ components }) {
  const from = '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b'
  let transactionData: TransactionData

  beforeEach(async () => {
    transactionData = {
      from,
      params: ['', ''],
    }
  })

  describe('when checking the quota for a new address', () => {
    beforeEach(() => {
      const { config, pg } = components
      const databaseResult = {
        rows: [{ count: 1 }],
      } as IDatabase.IQueryResult<{
        count: number
      }>

      jest.spyOn(config, 'requireNumber').mockResolvedValueOnce(100)
      jest.spyOn(pg, 'query').mockResolvedValueOnce(databaseResult)
    })

    it('should not throw an error', async () => {
      await expect(
        checkQuota(components, transactionData)
      ).resolves.not.toThrow()
    })
  })

  describe('when the quota limit is reached for a single day', () => {
    const maxTransactionsPerDay = 2

    beforeEach(() => {
      const { config, pg } = components
      const databaseResult = {
        rows: [{ count: maxTransactionsPerDay }],
      } as IDatabase.IQueryResult<{
        count: number
      }>

      jest.spyOn(config, 'requireNumber').mockResolvedValueOnce(2)
      jest.spyOn(pg, 'query').mockResolvedValueOnce(databaseResult)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should throw an error signaling that the quota was reached', async () => {
      const error = new QuotaReachedError(from, maxTransactionsPerDay)

      await expect(checkQuota(components, transactionData)).rejects.toThrow(
        error.message
      )
    })
  })
})
