import { AppComponents } from '../../../types'
import { TransactionData } from '../types'

/**
 * Checks for the validity of the transaction data.
 * It should throw when the data is invalid
 */
export type ITransactionValidator = (
  components: Pick<
    AppComponents,
    'config' | 'database' | 'contracts' | 'fetcher' | 'metrics'
  >,
  transactionData: TransactionData
) => Promise<void>
