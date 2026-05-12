import SQL from 'sql-template-strings'
import { extractMetaTxUserAddress } from './extractMetaTxUserAddress'
import { QuotaReachedError } from '../../../types/transactions/errors'
import type { ITransactionValidator } from './types'

// Read-only fast-fail. The authoritative gate is the handler's atomic
// reserveQuota — this validator just rejects obviously-over-limit requests
// before they consume RPC calls in checkGasPrice / checkTransaction.
export const checkQuota: ITransactionValidator = async (
  components,
  transactionData
) => {
  const { config, pg } = components

  const maxTransactionsPerDay = await config.requireNumber(
    'MAX_TRANSACTIONS_PER_DAY'
  )

  const userAddress = extractMetaTxUserAddress(transactionData.params[1])

  const result = await pg.query<{ count: number }>(SQL`
    SELECT COUNT(*)::int AS count
    FROM transactions
    WHERE user_address = ${userAddress}
      AND created_at >= NOW() - INTERVAL '1 day'
  `)

  const count = Number(result.rows[0].count)
  if (count >= maxTransactionsPerDay) {
    throw new QuotaReachedError(userAddress, count)
  }
}
