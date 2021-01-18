import { IDatabase } from '@well-known-components/interfaces'
import SQL from 'sql-template-strings'
import { IDatabaseComponent } from '../ports/database/types'
import { AppComponents } from '../types'
import {
  MetaTransactionRequest,
  MetaTransactionResponse,
  TransactionData,
  TransactionRow,
} from '../types/transaction'

export async function sendMetaTransaction(
  components: Pick<AppComponents, 'config' | 'database'>,
  transactionData: TransactionData
) {
  const { config, database } = components

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

  await database.run(
    `INSERT INTO transactions(
        txHash, userAddress, contractAddress
      ) VALUES (
        $txHash, $userAddress, $contractAddress
    )`,
    {
      $txHash: data.txHash,
      $userAddress: transactionData.from,
      $contractAddress: transactionData.to,
    }
  )

  return data
}

export async function getByUserAddress(
  database: IDatabaseComponent,
  userAddress: string
): Promise<IDatabase.IQueryResult<TransactionRow>> {
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
