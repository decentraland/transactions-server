import { IDatabase } from '@well-known-components/interfaces'
import SQL from 'sql-template-strings'
import { AppComponents } from '../../types'
import {
  checkSchema,
  checkSalePrice,
  checkContractAddress,
  checkQuota,
} from './validation'
import { InvalidTransactionError } from './errors'
import {
  ITransactionComponent,
  MetaTransactionCode,
  MetaTransactionRequest,
  MetaTransactionResponse,
  MetaTransactionStatus,
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

    body.params[1] = body.params[1].replace('a', '1')

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

    if (result.status !== MetaTransactionStatus.OK) {
      let message: string | undefined
      let code: MetaTransactionCode | undefined

      switch (result.status) {
        case MetaTransactionStatus.CONFLICT:
          const response: MetaTransactionResponse = await result.json()
          // Conflict errors always have message and code values
          message = response.message!
          code = response.code!

          // A limit was reached, check MetaTransactionCode for possible values
          metrics.increment('dcl_error_limit_reached_transactions_biconomy', {
            ...metricPayload,
            code,
          })
          break
        case MetaTransactionStatus.EXPECTATION_FAILED:
          code = MetaTransactionCode.EXPECTATION_FAILED

          // This error happens when the contract execution will fail. See https://github.com/decentraland/transactions-server/blob/2e5d833f672a87a7acf0ff761f986421676c4ec9/ERRORS.md
          metrics.increment(
            'dcl_error_cannot_estimate_gas_transactions_biconomy',
            metricPayload
          )
          break
        case MetaTransactionStatus.NOT_FOUND:
        case MetaTransactionStatus.INTERNAL_SERVER_ERROR:
        default:
          // Any other error is related to the Biconomy API
          metrics.increment(
            'dcl_error_relay_transactions_biconomy',
            metricPayload
          )
          break
      }

      message = message || (await result.text())

      throw new InvalidTransactionError(
        `An error occurred trying to send the meta transaction. Response: ${message}.
          ${result.statusText}`,
        code
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
