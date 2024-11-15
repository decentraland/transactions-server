import { AppComponents } from '../../../types'
import { TransactionData } from '../../../types/transactions/transactions'

/**
 * Checks for the validity of the transaction data.
 * It should throw when the data is invalid
 */
export type ITransactionValidator = (
  components: Pick<AppComponents, 'config' | 'pg'>,
  transactionData: TransactionData
) => Promise<void>

export type IGasPriceValidator = (
  components: Pick<
    AppComponents,
    'config' | 'contracts' | 'features' | 'biconomy' | 'gelato'
  >,
  transactionData: TransactionData
) => Promise<void>
