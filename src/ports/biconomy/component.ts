import { BigNumber } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import { ErrorCode } from 'decentraland-transactions'
import { ChainId } from '@dcl/schemas'
import { AppComponents } from '../../types'
import { TransactionData } from '../../types/transactions/transactions'
import {
  BiconomyMetaTransactionComponent,
  GasPriceResponse,
  MetaTransactionRequest,
  MetaTransactionResponse,
  MetaTransactionStatus,
  toErrorCode,
} from './types'
import { InvalidTransactionError } from '../../types/transactions/errors'

/**
 * @deprecated This component is deprecated and will be removed in a future version.
 * The Gelato component should be used instead.
 */
export async function createBiconomyComponent(
  components: Pick<AppComponents, 'config' | 'fetcher' | 'logs' | 'metrics'>
): Promise<BiconomyMetaTransactionComponent> {
  const { config, fetcher, metrics, logs } = components
  const logger = logs.getLogger('biconomy')
  const biconomyAPIId = await config.requireString('BICONOMY_API_ID')
  const biconomyAPIKey = await config.requireString('BICONOMY_API_KEY')
  const biconomyAPIURL = await config.requireString('BICONOMY_API_URL')

  async function sendMetaTransaction(
    transactionData: TransactionData
  ): Promise<string> {
    const body: MetaTransactionRequest = {
      apiId: biconomyAPIId,
      ...transactionData,
    }

    const result = await fetcher.fetch(
      `${biconomyAPIURL}/api/v2/meta-tx/native`,
      {
        headers: {
          'x-api-key': biconomyAPIKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        method: 'POST',
      }
    )

    if (result.status !== MetaTransactionStatus.OK) {
      let message: string | undefined
      let code: ErrorCode | undefined

      switch (result.status) {
        case MetaTransactionStatus.CONFLICT:
          const response: MetaTransactionResponse = await result.json()
          // Conflict errors always have message and code values
          message = response.message!
          code = toErrorCode(response.code!)
          logger.log(`Transaction relaying error: ${message} (${code})`)

          // A limit was reached, check ErrorCode for possible values
          metrics.increment('dcl_error_limit_reached_transactions_biconomy', {
            code,
          })
          break
        case MetaTransactionStatus.EXPECTATION_FAILED:
          code = ErrorCode.EXPECTATION_FAILED

          logger.log('Transaction relaying error: Cannot estimate gas')
          // This error happens when the contract execution will fail. See https://github.com/decentraland/transactions-server/blob/2e5d833f672a87a7acf0ff761f986421676c4ec9/ERRORS.md
          metrics.increment(
            'dcl_error_cannot_estimate_gas_transactions_biconomy'
          )
          break
        case MetaTransactionStatus.NOT_FOUND:
        case MetaTransactionStatus.INTERNAL_SERVER_ERROR:
        default:
          logger.log(
            `Transaction relaying error: Server error ${result.status}`
          )
          // Any other error is related to the Biconomy API
          metrics.increment('dcl_error_relay_transactions_biconomy')
          break
      }

      message = message || (await result.text())

      throw new InvalidTransactionError(
        `An error occurred trying to send the meta transaction. Response: ${message}. ${result.statusText}`,
        code
      )
    }

    const data: MetaTransactionResponse = await result.json()

    metrics.increment('dcl_sent_transactions_biconomy')

    return data.txHash!
  }

  const getNetworkGasPrice = async (
    chainId: ChainId
  ): Promise<BigNumber | null> => {
    try {
      const response = await fetcher.fetch(
        `${biconomyAPIURL}/api/v1/gas-price?networkId=${chainId}`
      )

      if (response.ok) {
        const result: GasPriceResponse = await response.json()
        return parseUnits(
          result.gasPrice.value.toString(),
          result.gasPrice.unit
        )
      } else {
        throw new Error(`Could not fetch the gas price from ${biconomyAPIURL}`)
      }
    } catch (error) {
      logger.error(error as Error)
    }

    return null
  }

  return {
    getNetworkGasPrice,
    sendMetaTransaction,
  }
}
