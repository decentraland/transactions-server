import { IDatabase } from '@well-known-components/interfaces'
import SQL from 'sql-template-strings'
import { ErrorCode } from 'decentraland-transactions'
import { AppComponents } from '../../types'
import {
  checkSchema,
  checkSalePrice,
  checkContractAddress,
  checkQuota,
  checkGasPrice,
} from './validation'
import { InvalidTransactionError, toErrorCode } from './errors'
import {
  ITransactionComponent,
  MetaTransactionRequest,
  MetaTransactionResponse,
  MetaTransactionStatus,
  TransactionData,
  TransactionRow,
} from './types'

export function createTransactionComponent(
  components: Pick<
    AppComponents,
    'config' | 'pg' | 'contracts' | 'features' | 'fetcher' | 'logs' | 'metrics'
  >
): ITransactionComponent {
  const { config, pg, fetcher, metrics } = components

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

    if (result.status !== MetaTransactionStatus.OK) {
      let message: string | undefined
      let code: ErrorCode | undefined

      switch (result.status) {
        case MetaTransactionStatus.CONFLICT:
          const response: MetaTransactionResponse = await result.json()
          // Conflict errors always have message and code values
          message = response.message!
          code = toErrorCode(response.code!)

          // A limit was reached, check ErrorCode for possible values
          metrics.increment('dcl_error_limit_reached_transactions_biconomy', {
            code,
          })
          break
        case MetaTransactionStatus.EXPECTATION_FAILED:
          code = ErrorCode.EXPECTATION_FAILED

          // This error happens when the contract execution will fail. See https://github.com/decentraland/transactions-server/blob/2e5d833f672a87a7acf0ff761f986421676c4ec9/ERRORS.md
          metrics.increment(
            'dcl_error_cannot_estimate_gas_transactions_biconomy'
          )
          break
        case MetaTransactionStatus.NOT_FOUND:
        case MetaTransactionStatus.INTERNAL_SERVER_ERROR:
        default:
          // Any other error is related to the Biconomy API
          metrics.increment('dcl_error_relay_transactions_biconomy')
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

    metrics.increment('dcl_sent_transactions_biconomy')

    return data.txHash!
  }

  async function insert(
    row: Omit<TransactionRow, 'id' | 'created_at'>
  ): Promise<void> {
    await pg.query(
      SQL`INSERT INTO transactions(
          tx_hash, user_address
        ) VALUES (
          ${row.tx_hash}, ${row.user_address}
        )`
    )
  }

  async function getByUserAddress(
    userAddress: string
  ): Promise<IDatabase.IQueryResult<TransactionRow>> {
    return pg.query<TransactionRow>(
      SQL`SELECT *
          FROM transactions
          WHERE user_address = ${userAddress}`
    )
  }

  async function checkData(transactionData: TransactionData): Promise<void> {
    await checkSchema(components, transactionData)
    await checkGasPrice(components, transactionData)
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
