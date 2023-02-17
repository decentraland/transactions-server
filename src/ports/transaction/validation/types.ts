import { AppComponents } from '../../../types'
import { TransactionData } from '../types'

/**
 * Checks for the validity of the transaction data.
 * It should throw when the data is invalid
 */
export type ITransactionValidator = (
  components: Pick<
    AppComponents,
    'config' | 'pg' | 'contracts' | 'fetcher' | 'metrics'
  >,
  transactionData: TransactionData
) => Promise<void>

export type IGasPriceValidator = (
  components: Pick<AppComponents, 'config' | 'features' | 'fetcher' | 'logs'>
) => Promise<void>

export type GasPriceResponse = {
  code: number
  message: string
  gasPrice: {
    value: number
    unit: string
  }
  networkId: string
}
