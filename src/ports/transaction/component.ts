import { IDatabase } from '@well-known-components/interfaces'
import SQL from 'sql-template-strings'
import { AppComponents } from '../../types'
import {
  checkSchema,
  checkSalePrice,
  checkContractAddress,
  checkQuota,
} from './validation'
import { MetaTransactionError } from './errors'
import {
  ITransactionComponent,
  MetaTransactionRequest,
  MetaTransactionResponse,
  TransactionData,
  TransactionRow,
} from './types'

export function createTransactionComponent(
  components: Pick<
    AppComponents,
    'config' | 'database' | 'contracts' | 'fetcher' | 'metrics'
  >
): ITransactionComponent {
  const { config, database, fetcher, metrics } = components

  async function sendMetaTransaction(
    transactionData: TransactionData
  ): Promise<string> {
    const biconomyAPIId = await config.requireString('BICONOMY_API_ID')
    const biconomyAPIKey = await config.requireString('BICONOMY_API_KEY')
    const biconomyAPIURL = await config.requireString('BICONOMY_API_URL')

    const body: MetaTransactionRequest = {
      apiId: biconomyAPIId,
      ...transactionData,
    }

    const result = await fetcher.fetch(biconomyAPIURL, {
      headers: {
        'x-api-key': biconomyAPIKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      method: 'POST',
    })

    const metricPayload = {
      contract: transactionData.params[0],
    }

    if (!result.ok) {
      const errorMessage = await result.text()
      if (errorMessage.includes('UNPREDICTABLE_GAS_LIMIT')) {
        // This error happens when the contract execution will fail. See https://github.com/decentraland/transactions-server/blob/2e5d833f672a87a7acf0ff761f986421676c4ec9/ERRORS.md
        metrics.increment(
          'dcl_error_cannot_estimate_gas_transactions_biconomy',
          metricPayload
        )
      } else {
        // Any other error is related to the Biconomy API
        metrics.increment(
          'dcl_error_relay_transactions_biconomy',
          metricPayload
        )
      }

      throw new MetaTransactionError(
        `An error occurred trying to send the meta transaction. Response: ${errorMessage}.
          ${result.statusText}`
      )
    }

    const data: MetaTransactionResponse = await result.json()

    metrics.increment('dcl_sent_transactions_biconomy', metricPayload)

    return data.txHash!
  }

  async function insert(
    row: Omit<TransactionRow, 'id' | 'createdAt'>
  ): Promise<void> {
    await database.run(
      `INSERT INTO transactions(
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

  async function getByUserAddress(
    userAddress: string
  ): Promise<IDatabase.IQueryResult<TransactionRow>> {
    return database.query<TransactionRow>(
      SQL`SELECT *
          FROM transactions
          WHERE userAddress = ${userAddress}`
    )
  }

  async function checkData(transactionData: TransactionData): Promise<void> {
    await checkSchema(components, transactionData)
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
