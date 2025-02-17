import { IDatabase } from '@well-known-components/interfaces'
import SQL from 'sql-template-strings'
import { AppComponents } from '../../types'
import { TransactionData } from '../../types/transactions/transactions'
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
  >
): ITransactionComponent {
  const { gelato, pg } = components

  async function sendMetaTransaction(
    transactionData: TransactionData
  ): Promise<string> {
    return gelato.sendMetaTransaction(transactionData)
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
