import SQL from 'sql-template-strings'
import { QuotaReachedError } from '../errors'
import { ITransactionValidator } from './types'

export const checkQuota: ITransactionValidator = async (
  components,
  transactionData
) => {
  const { config, pg } = components

  const maxTransactionsPerDay = await config.requireNumber(
    'MAX_TRANSACTIONS_PER_DAY'
  )
  const { from } = transactionData

  const todayAddressTransactions = await pg.query<{ count: number }>(
    SQL`SELECT COUNT (*) as count
        FROM transactions
        WHERE userAddress = ${from}
          AND createdAt >= date('now', 'start of day')`
  )

  const dbResult = todayAddressTransactions.rows[0]
  if (dbResult.count >= maxTransactionsPerDay) {
    throw new QuotaReachedError(from, dbResult.count)
  }
}
