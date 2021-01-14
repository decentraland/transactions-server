import 'isomorphic-fetch'
import SQL from 'sql-template-strings'
import { AppComponents } from '../../types'
import {
  ITransactionComponent,
  MetaTransactionRequest,
  TransactionRow,
  TransactionData,
  MetaTransactionResponse,
} from './types'

export async function createTransactionComponent(
  components: Pick<AppComponents, 'config' | 'logs' | 'database'>
): Promise<ITransactionComponent> {
  const { config, logs, database } = components
  const logger = logs.getLogger('transaction-component')

  // Config
  const biconomiAPIId = await config.requireString('BICONOMY_API_ID')
  const biconomyAPIKey = await config.requireString('BICONOMY_API_KEY')
  const biconomyAPIURL = await config.requireString('BICONOMY_API_URL')
  const maxTransactionsPerDay = await config.requireNumber(
    'MAX_TRANSACTIONS_PER_DAY'
  )

  logger.log(`URL for meta transactions: ${biconomyAPIURL}`)
  logger.log(
    `Using ${maxTransactionsPerDay} as the max amount of transactions permitted per day`
  )

  // Methods
  // TODO: This method is doing too many things
  async function sendMetaTransaction(transactionData: TransactionData) {
    logger.debug(
      `Meta transaction data to send: ${JSON.stringify(transactionData)}`
    )

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

  async function getByUserAddress(userAddress: string) {
    return database.query<TransactionRow>(
      SQL`SELECT *
        FROM transactions
        WHERE userAddress = ${userAddress}`
    )
  }

  async function checkTransactionData(transactionData: TransactionData) {
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

  return {
    sendMetaTransaction,
    getByUserAddress,
    checkTransactionData,
  }
}
