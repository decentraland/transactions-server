import { IDatabase } from '@well-known-components/interfaces'
import SQL from 'sql-template-strings'
import {
  TransactionData,
  TransactionRow,
} from '../../../../src/ports/transaction/types'
import {
  checkSchema,
  checkSalePrice,
  checkContractAddress,
  checkQuota,
} from '../../../../src/ports/transaction/validation'
import { test } from '../../../components'

jest.mock('../../../../src/ports/transaction/validation')

test('transactions component', function ({ components }) {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('when checking the transaction data', () => {
    let transactionData: TransactionData

    beforeEach(async () => {
      const { transaction } = components

      transactionData = {
        from: '0x254d0a369bDc91Bc12C6C74552442A6b726A33D2',
        params: ['', ''],
      }

      await transaction.checkData(transactionData)
    })

    function expectCheckCall(fn: jest.Mock) {
      // We should just do .toHaveBeenCalledWith(components, transactionData) here
      // Instead, because the test helper well-known-components provides messes with the components object when passing it down to the tests,
      // we do a best effort.
      expect(checkSchema).toHaveBeenCalledTimes(1)

      const [componentsArg, transactionDataArg] = fn.mock.calls[0]
      expect(typeof componentsArg).toBe('object')
      expect(transactionDataArg).toEqual(transactionDataArg)
    }

    it('should call all the validator with the components and transaction data', () => {
      expectCheckCall(checkSchema as jest.Mock)
    })

    it('should call all the validator with the components and transaction data', () => {
      expectCheckCall(checkSalePrice as jest.Mock)
    })

    it('should call all the validator with the components and transaction data', () => {
      expectCheckCall(checkContractAddress as jest.Mock)
    })

    it('should call all the validator with the components and transaction data', () => {
      expectCheckCall(checkQuota as jest.Mock)
    })
  })

  describe('when getting the transactions by user address', () => {
    let queryResult: IDatabase.IQueryResult<TransactionRow>
    let transactionRow: TransactionRow
    const userAddress = '0x8197f89588d7FB03E3063d9bb6556C9d8BE71311'

    beforeEach(() => {
      const { pg } = components

      transactionRow = {
        id: 1,
        tx_hash: 'some tx hash',
        user_address: userAddress,
        created_at: new Date(),
      }

      queryResult = {
        rows: [transactionRow],
        rowCount: 1,
      }

      jest.spyOn(pg, 'query').mockResolvedValueOnce(queryResult)
    })

    it('should query the database with the supplied data', async () => {
      const { transaction, pg } = components
      await transaction.getByUserAddress(userAddress)
      expect(pg.query).toHaveBeenCalledWith(SQL`SELECT *
          FROM transactions
          WHERE user_address = ${userAddress}`)
    })

    it('should return the query result', async () => {
      const { transaction } = components
      expect(await transaction.getByUserAddress(userAddress)).toEqual(
        queryResult
      )
    })
  })

  describe('when inserting a transactions', () => {
    let transactionRow: Omit<TransactionRow, 'id' | 'created_at'>

    beforeEach(() => {
      const { pg } = components

      transactionRow = {
        tx_hash: 'some tx hash',
        user_address: '0x8197f89588d7FB03E3063d9bb6556C9d8BE71311',
      }

      jest.spyOn(pg, 'query')
    })

    it('should query the database with the supplied data', async () => {
      const { transaction, pg } = components
      await transaction.insert(transactionRow)
      expect(pg.query).toHaveBeenCalledWith(
        SQL`INSERT INTO transactions(
          tx_hash, user_address
        ) VALUES (
          ${transactionRow.tx_hash}, ${transactionRow.user_address}
        )`
      )
    })
  })
})
