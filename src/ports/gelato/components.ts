import { BigNumber, providers } from 'ethers'
import { ErrorCode } from 'decentraland-transactions'
import { AppComponents } from '../../types'
import {
  TransactionData,
  InvalidTransactionError,
  RelayerError,
  RelayerTimeout,
} from '../../types/transactions'
import { sleep } from '../../logic/time'
import {
  GelatoMetaTransactionComponent,
  GelatoJsonRpcResponse,
  GelatoTaskStatusResult,
  TaskStatus,
} from './types'

export async function createGelatoComponent(
  components: Pick<AppComponents, 'config' | 'fetcher' | 'logs' | 'metrics'>
): Promise<GelatoMetaTransactionComponent> {
  const { config, fetcher, logs, metrics } = components
  const logger = logs.getLogger('gelato')
  const gelatoAPIKey = await config.requireString('GELATO_API_KEY')
  const gelatoAPIURL = await config.requireString('GELATO_API_URL')
  const rpcURL = await config.requireString('RPC_URL')
  const chainId = await config.requireNumber('COLLECTIONS_CHAIN_ID')
  const gelatoMaxStatusChecks = await config.requireNumber(
    'GELATO_MAX_STATUS_CHECKS'
  )
  const gelatoSleepTimeBetweenChecks = await config.requireNumber(
    'GELATO_SLEEP_TIME_BETWEEN_CHECKS'
  )

  async function sendMetaTransaction(
    transactionData: TransactionData
  ): Promise<string> {
    const response = await fetcher.fetch(`${gelatoAPIURL}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': gelatoAPIKey,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'relayer_sendTransaction',
        id: 1,
        params: {
          chainId: String(chainId),
          to: transactionData.params[0],
          data: transactionData.params[1],
          payment: { type: 'sponsored' },
        },
      }),
    })

    if (response.ok) {
      const data =
        (await response.json()) as GelatoJsonRpcResponse<string>

      if (data.error) {
        metrics.increment('dcl_error_service_errors_gelato')
        logger.error(
          `Gelato failed to relay the transaction: ${data.error.message}`
        )
        throw new RelayerError(data.error.code, data.error.message)
      }

      return getTxHashFromGelatoResponse(data.result!)
    } else {
      metrics.increment('dcl_error_service_errors_gelato')
      logger.error(
        `Gelato failed to relay the transaction with a ${response.status} status`
      )
      throw new RelayerError(response.status, 'Failed to relay the transaction')
    }
  }

  const getTxHashFromGelatoResponse = async (
    taskId: string
  ): Promise<string> => {
    let txHash: string | undefined
    let checks: number = 0

    while (!txHash) {
      if (checks >= gelatoMaxStatusChecks) {
        logger.error('Gelato task status checks limit reached')
        metrics.increment('dcl_error_timeout_gelato')
        throw new RelayerTimeout('The limit of status checks was reached')
      }

      const response = await fetcher.fetch(`${gelatoAPIURL}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': gelatoAPIKey,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'relayer_getStatus',
          id: 1,
          params: {
            id: taskId,
            logs: false,
          },
        }),
      })

      if (response.ok) {
        const data =
          (await response.json()) as GelatoJsonRpcResponse<GelatoTaskStatusResult>

        if (data.error) {
          logger.error(
            `Gelato failed to get the status of the related transaction: ${data.error.message}`
          )
          metrics.increment('dcl_error_service_errors_gelato')
          throw new RelayerError(data.error.code, data.error.message)
        }

        const result = data.result!

        if (result.status === TaskStatus.Reverted) {
          logger.error(
            `Gelato task ${taskId} reverted: ${result.error}`
          )
          metrics.increment('dcl_error_reverted_transactions_gelato')
          throw new InvalidTransactionError(
            'Transaction reverted',
            ErrorCode.EXPECTATION_FAILED
          )
        } else if (result.status === TaskStatus.Rejected) {
          logger.error(
            `Gelato task ${taskId} rejected: ${result.error}`
          )
          metrics.increment('dcl_error_cancelled_transactions_gelato')

          const noBalanceLeftInGasTankError =
            result.error?.includes('No available token balance')
          const noTokensConfiguredInGasTankSetError =
            result.error?.includes(
              '1Balance tokens could not be selected'
            )

          if (
            noBalanceLeftInGasTankError ||
            noTokensConfiguredInGasTankSetError
          ) {
            metrics.increment('dcl_error_no_balance_transactions_gelato')
          }

          throw new InvalidTransactionError(
            'Transaction cancelled',
            ErrorCode.EXPECTATION_FAILED
          )
        } else if (
          result.status === TaskStatus.Submitted ||
          result.status === TaskStatus.Included
        ) {
          txHash = result.transactionHash
        }
        await sleep(gelatoSleepTimeBetweenChecks)
      } else {
        logger.error(
          `Gelato failed to get the status of the related transaction with a ${response.status} status`
        )
        metrics.increment('dcl_error_service_errors_gelato')
        throw new RelayerError(response.status, 'Failed to get transaction status')
      }

      checks++
    }

    metrics.increment('dcl_sent_transactions_gelato')
    return txHash
  }

  const getNetworkGasPrice = async (): Promise<BigNumber | null> => {
    try {
      const provider = new providers.JsonRpcProvider(rpcURL)
      const gasPrice = await provider.getGasPrice()
      return gasPrice
    } catch (error) {
      logger.error('Gelato failed to get the network gas price')
      return null
    }
  }

  return {
    getNetworkGasPrice,
    sendMetaTransaction,
  }
}
