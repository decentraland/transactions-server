import * as fetch from 'node-fetch'
import { BigNumber, providers } from 'ethers'
import { ErrorCode } from 'decentraland-transactions'
import { AppComponents } from '../../types'
import {
  TransactionData,
  InvalidTransactionError,
  RelayerError,
  RelayerTimeout,
} from '../../types/transactions'
import { encodeFunctionData } from '../../logic/ethereum'
import { sleep } from '../../logic/time'
import { getMetaTxForwarder } from '../contracts/MetaTxForwarder'
import {
  GelatoMetaTransactionComponent,
  GelatoTaskStatusResponse,
  TaskState,
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

  const extractErrorMessage = async (
    response: fetch.Response
  ): Promise<string> => {
    try {
      if (response.headers.get('content-type')?.includes('application/json')) {
        return ((await response.json()) as { message: string }).message
      }
    } catch (_) {
      // Ignore
    }
    return 'Unknown error'
  }

  async function sendMetaTransaction(
    transactionData: TransactionData
  ): Promise<string> {
    /* The Gelato relayer is configured to support the MetaTxForwarder.forwardMetaTx method.
     * To ensure the relay endpoint processes the transaction correctly, we must encode the
     * parameters of the transaction (`transactionData.params`) into the required format.
     * For more information, refer to:
     * https://docs.gelato.network/web3-services/relay/non-erc-2771/sponsoredcall#request-body
     */

    const metaTxForwarderContract = getMetaTxForwarder(chainId)

    const encodedData = encodeFunctionData(
      metaTxForwarderContract.abi,
      'forwardMetaTx',
      transactionData.params
    )

    const response = await fetcher.fetch(
      `${gelatoAPIURL}/relays/v2/sponsored-call`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chainId,
          target: metaTxForwarderContract.address,
          data: encodedData,
          sponsorApiKey: gelatoAPIKey,
        }),
      }
    )

    if (response.ok) {
      const data = (await response.json()) as { taskId: string }
      return getTxHashFromGelatoResponse(data.taskId)
    } else {
      const message = await extractErrorMessage(response)

      metrics.increment('dcl_error_service_errors_gelato')
      logger.error(
        `Gelato failed to relay the transaction with a ${response.status} status: ${message}`
      )
      throw new RelayerError(response.status, message)
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

      const response = await fetcher.fetch(
        `${gelatoAPIURL}/tasks/status/${taskId}`
      )

      if (response.ok) {
        const data = (await response.json()) as GelatoTaskStatusResponse
        if (data.task.taskState === TaskState.ExecReverted) {
          logger.error(
            `Gelato task ${taskId} reverted: ${data.task.lastCheckMessage}`
          )
          metrics.increment('dcl_error_reverted_transactions_gelato')
          throw new InvalidTransactionError(
            'Transaction reverted',
            ErrorCode.EXPECTATION_FAILED
          )
        } else if (data.task.taskState === TaskState.Cancelled) {
          logger.error(
            `Gelato task ${taskId} cancelled: ${data.task.lastCheckMessage}`
          )
          metrics.increment('dcl_error_cancelled_transactions_gelato')
          const noBalanceLeftInGasTankError =
            data.task.lastCheckMessage?.includes('No available token balance')
          const noTokensConfiguredInGasTankSetError =
            data.task.lastCheckMessage?.includes(
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
          data.task.taskState === TaskState.ExecPending ||
          data.task.taskState === TaskState.ExecSuccess ||
          data.task.taskState === TaskState.WaitingForConfirmation
        ) {
          txHash = data.task.transactionHash
        }
        await sleep(gelatoSleepTimeBetweenChecks)
      } else {
        const message = await extractErrorMessage(response)
        logger.error(
          `Gelato failed to get the status of the related transaction with a ${response.status} status: ${message}`
        )
        metrics.increment('dcl_error_service_errors_gelato')
        throw new RelayerError(response.status, message)
      }
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
