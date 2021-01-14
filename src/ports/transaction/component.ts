import 'isomorphic-fetch'
import { AppComponents } from '../../types'
import {
  ITransactionComponent,
  MetaTransactionRequest,
  MetaTransactionResponse,
  TransactionRow,
  TransactionData,
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
  const whitelistedContracts = ['0xfe4f5145f6e09952a5ba9e956ed0c25e3fa4c7f1'] // TODO: Environments

  logger.log(`URL for meta transactions: ${biconomyAPIURL}`)
  logger.log(
    `Using ${maxTransactionsPerDay} as the max amount of transactions permitted per day`
  )

  // Methods
  async function sendMetaTransaction(transactionData: TransactionData) {
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

    await database.run(
      `INSERT INTO transactions(
        txHash, userAddress, contractAddress, ip
      ) VALUES (
        $txHash, $userAddress, $contractAddress, $ip
    )`,
      {
        $txHash: data.txHash,
        $userAddress: transactionData.userAddress,
        $contractAddress: transactionData.to,
        $ip: '192.168.0.2', // TODO: Use the real IP
      }
    )

    return data
  }

  async function getByUserAddress(userAddress: string) {
    return database.query<TransactionRow>(
      `SELECT *
        FROM transactions
        WHERE user_address = $1`,
      [userAddress]
    )
  }

  async function isValidTransactionData(transactionData: TransactionData) {
    const { userAddress, to } = transactionData

    if (!whitelistedContracts.includes(to.toLowerCase())) {
      logger.info(
        `Trying to send transaction to invalid contract address ${to}`
      )
      return false
    }

    const todayAddressTransactions = await database.query<TransactionRow[]>(
      `SELECT *
        FROM transactions
        WHERE user_address = $1
          AND createdAt >= date('now', 'start of day')`,
      [userAddress]
    )
    // TODO: Do the same for IPs

    if (todayAddressTransactions.rowCount >= maxTransactionsPerDay) {
      logger.info(
        `Max amount of transactions reached for address ${userAddress}`
      )
      return false
    }

    return true
  }

  return {
    sendMetaTransaction,
    getByUserAddress,
    isValidTransactionData,
  }
}
