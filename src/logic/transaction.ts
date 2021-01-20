import { IDatabase } from '@well-known-components/interfaces'
import SQL from 'sql-template-strings'
import fetch from 'node-fetch'
import {
  MetaTransactionRequest,
  MetaTransactionResponse,
  TransactionData,
  TransactionRow,
  transactionSchema,
} from '../types/transaction'
import { AppComponents } from '../types'
import { generateValidator } from './validation'

export async function sendMetaTransaction(
  components: Pick<AppComponents, 'config'>,
  transactionData: TransactionData
): Promise<string> {
  const { config } = components

  const biconomiAPIId = await config.requireString('BICONOMY_API_ID')
  const biconomyAPIKey = await config.requireString('BICONOMY_API_KEY')
  const biconomyAPIURL = await config.requireString('BICONOMY_API_URL')

  const body: MetaTransactionRequest = {
    apiId: biconomiAPIId,
    ...transactionData,
  }

  const result = await fetch(biconomyAPIURL, {
    headers: {
      'x-api-key': biconomyAPIKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    method: 'POST',
  })
  const data: MetaTransactionResponse = await result.json()

  if (data.code !== 200) {
    throw new Error(
      `An error occurred trying to send the meta transaction ${data.message}`
    )
  }
  return data.txHash!
}

export async function insertTransaction(
  components: Pick<AppComponents, 'database'>,
  row: Omit<TransactionRow, 'id' | 'createdAt'>
) {
  const { database } = components
  await database.run(
    `INSERT INTO transactions(
        txHash, userAddress
      ) VALUES (
        $txHash, $userAddress
    )`,
    {
      $txHash: row.txHash,
      $userAddress: row.userAddress,
    }
  )
}

export async function getByUserAddress(
  components: Pick<AppComponents, 'database'>,
  userAddress: string
): Promise<IDatabase.IQueryResult<TransactionRow>> {
  const { database } = components
  return database.query<TransactionRow>(
    SQL`SELECT *
        FROM transactions
        WHERE userAddress = ${userAddress}`
  )
}

export async function checkTransactionData(
  components: Pick<AppComponents, 'config' | 'database'>,
  transactionData: TransactionData
) {
  const { config, database } = components

  const maxTransactionsPerDay = await config.requireNumber(
    'MAX_TRANSACTIONS_PER_DAY'
  )
  const { from } = transactionData

  const todayAddressTransactions = await database.query<{ count: number }>(
    SQL`SELECT COUNT (*) as count
        FROM transactions
        WHERE userAddress = ${from}
          AND createdAt >= date('now', 'start of day')`
  )

  const result = todayAddressTransactions.rows[0]
  if (result.count >= maxTransactionsPerDay) {
    throw new Error(`Max amount of transactions reached for address ${from}`)
  }
}

export const validateTrasactionSchema = generateValidator(transactionSchema)
