import { IDatabase } from '@well-known-components/interfaces'
import { ApplicationName } from '@well-known-components/features-component'
import SQL from 'sql-template-strings'
import { AppComponents } from '../../types'
import { TransactionData } from '../../types/transactions/transactions'
import { Feature } from '../features'
import {
  checkSchema,
  checkSalePrice,
  checkContractAddress,
  checkQuota,
  checkGasPrice,
  checkTransaction,
} from './validation'
import { ITransactionComponent, TransactionRow } from './types'

export function createTransactionComponent(
  components: Pick<
    AppComponents,
    | 'config'
    | 'pg'
    | 'contracts'
    | 'features'
    | 'fetcher'
    | 'logs'
    | 'metrics'
    | 'gelato'
    | 'biconomy'
  >
): ITransactionComponent {
  const { features, gelato, biconomy, pg } = components

  async function sendMetaTransaction(
    transactionData: TransactionData
  ): Promise<string> {
    const isGelatoRelayerEnabled = await features.getIsFeatureEnabled(
      ApplicationName.DAPPS,
      Feature.GELATO_RELAYER
    )
    if (isGelatoRelayerEnabled) {
      return gelato.sendMetaTransaction(transactionData)
    }

    return biconomy.sendMetaTransaction(transactionData)
  }

  async function insert(
    row: Omit<TransactionRow, 'id' | 'created_at'>
  ): Promise<void> {
    await pg.query(
      SQL`INSERT INTO transactions(tx_hash, user_address) VALUES (${row.tx_hash}, ${row.user_address})`
    )
  }

  async function getByUserAddress(
    userAddress: string
  ): Promise<IDatabase.IQueryResult<TransactionRow>> {
    return pg.query<TransactionRow>(
      SQL`SELECT * FROM transactions WHERE user_address = ${userAddress}`
    )
  }

  async function checkData(transactionData: TransactionData): Promise<void> {
    await checkSchema(components, transactionData)
    await checkGasPrice(components, transactionData)
    await checkTransaction(components, transactionData)
    await checkSalePrice(components, transactionData)
    await checkContractAddress(components, transactionData)
    await checkQuota(components, transactionData)
  }

  return {
    sendMetaTransaction,
    insert,
    getByUserAddress,
    checkData,
  }
}
