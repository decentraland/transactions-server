import {
  createGelatoEvmRelayerClient,
  TransactionRejectedError,
  TransactionRevertedError,
  InsufficientBalanceRpcError,
} from '@gelatocloud/gasless'
import { createPublicClient, http } from 'viem'
import { ErrorCode } from 'decentraland-transactions'
import { AppComponents } from '../../types'
import {
  TransactionData,
  InvalidTransactionError,
  RelayerError,
  RelayerTimeout,
} from '../../types/transactions'
import { GelatoMetaTransactionComponent } from './types'

export async function createGelatoComponent(
  components: Pick<AppComponents, 'config' | 'logs' | 'metrics'>
): Promise<GelatoMetaTransactionComponent> {
  const { config, logs, metrics } = components
  const logger = logs.getLogger('gelato')
  const gelatoAPIKey = await config.requireString('GELATO_API_KEY')
  const rpcURL = await config.requireString('RPC_URL')
  const chainId = await config.requireNumber('COLLECTIONS_CHAIN_ID')

  const relayer = createGelatoEvmRelayerClient({
    apiKey: gelatoAPIKey,
  })

  async function sendMetaTransaction(
    transactionData: TransactionData
  ): Promise<string> {
    let taskId: string

    try {
      taskId = await relayer.sendTransaction({
        chainId,
        to: transactionData.params[0] as `0x${string}`,
        data: transactionData.params[1] as `0x${string}`,
      })
    } catch (error) {
      metrics.increment('dcl_error_service_errors_gelato')
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`Gelato failed to relay the transaction: ${message}`)

      if (error instanceof InsufficientBalanceRpcError) {
        metrics.increment('dcl_error_no_balance_transactions_gelato')
      }

      throw new RelayerError(500, message)
    }

    try {
      const receipt = await relayer.waitForReceipt(
        { id: taskId },
        { throwOnReverted: true }
      )
      metrics.increment('dcl_sent_transactions_gelato')
      return receipt.transactionHash
    } catch (error) {
      if (error instanceof TransactionRevertedError) {
        logger.error(`Gelato task ${taskId} reverted: ${error.errorMessage}`)
        metrics.increment('dcl_error_reverted_transactions_gelato')
        throw new InvalidTransactionError(
          'Transaction reverted',
          ErrorCode.EXPECTATION_FAILED
        )
      }

      if (error instanceof TransactionRejectedError) {
        logger.error(`Gelato task ${taskId} cancelled: ${error.errorMessage}`)
        metrics.increment('dcl_error_cancelled_transactions_gelato')

        const errorMsg = error.errorMessage || ''
        if (
          errorMsg.includes('No available token balance') ||
          errorMsg.includes('1Balance tokens could not be selected')
        ) {
          metrics.increment('dcl_error_no_balance_transactions_gelato')
        }

        throw new InvalidTransactionError(
          'Transaction cancelled',
          ErrorCode.EXPECTATION_FAILED
        )
      }

      // Timeout or other errors
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message.includes('Timeout')) {
        logger.error('Gelato task status checks limit reached')
        metrics.increment('dcl_error_timeout_gelato')
        throw new RelayerTimeout('The limit of status checks was reached')
      }

      metrics.increment('dcl_error_service_errors_gelato')
      logger.error(
        `Gelato failed to get the status of the related transaction: ${message}`
      )
      throw new RelayerError(500, message)
    }
  }

  const getNetworkGasPrice = async (): Promise<bigint | null> => {
    try {
      const client = createPublicClient({ transport: http(rpcURL) })
      const gasPrice = await client.getGasPrice()
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
