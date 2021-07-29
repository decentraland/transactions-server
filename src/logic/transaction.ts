import { IDatabase } from '@well-known-components/interfaces'
import SQL from 'sql-template-strings'
import {
  MetaTransactionErrorCode,
  MetaTransactionRequest,
  MetaTransactionResponse,
  TransactionData,
  TransactionRow,
  transactionSchema,
} from '../types/transaction'
import { AppComponents } from '../types'
import { generateValidator } from './validation'

export async function sendMetaTransaction(
  components: Pick<AppComponents, 'config' | 'fetcher' | 'metrics'>,
  transactionData: TransactionData
): Promise<string> {
  const {
    config,
    fetcher: { fetch },
    metrics,
  } = components

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

  if (!result.ok) {
    const errorMessage = await result.text()
    const errorPayload = {
      contract: transactionData.params[0],
      data: transactionData.params[1],
      from: transactionData.from,
    }
    if (errorMessage.includes('UNPREDICTABLE_GAS_LIMIT')) {
      // This error happens when the contract execution will fail. See https://github.com/decentraland/transactions-server/blob/2e5d833f672a87a7acf0ff761f986421676c4ec9/ERRORS.md
      metrics.increment(
        'dcl_error_cannot_estimate_gas_transactions_biconomy',
        errorPayload
      )
    } else {
      // Any other error is related to the Biconomy API
      metrics.increment('dcl_error_relay_transactions_biconomy', errorPayload)
    }

    throw new MetaTransactionError(
      `An error occurred trying to send the meta transaction. Response: ${errorMessage}.
        ${result.statusText}`
    )
  }

  const data: MetaTransactionResponse = await result.json()

  metrics.increment('dcl_sent_transactions_biconomy', {
    contract: transactionData.params[0],
  })

  return data.txHash!
}

export async function insertTransaction(
  components: Pick<AppComponents, 'database'>,
  row: Omit<TransactionRow, 'id' | 'createdAt'>
) {
  const { database } = components
  await database.run(
    ` INSERT INTO transactions(
        txHash, userAddress
      ) VALUES (
        $txHash, $userAddress
      )
    `,
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

export class MetaTransactionError extends Error {
  code?: MetaTransactionErrorCode

  // For more info on error codes, see https://docs.biconomy.io/api/native-meta-tx
  constructor(message: string, code?: MetaTransactionErrorCode) {
    super(message)
    this.code = code
  }
}
