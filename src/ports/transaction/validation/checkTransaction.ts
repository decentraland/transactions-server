import { createPublicClient, http } from 'viem'
import { isErrorWithMessage } from '../../../logic/errors'
import { SimulateTransactionError } from '../../../types/transactions/errors'
import { ITransactionValidator } from './types'

export const checkTransaction: ITransactionValidator = async (
  components,
  transactionData
) => {
  const { config, metrics } = components
  const rpcURL = await config.requireString('RPC_URL')

  const client = createPublicClient({ transport: http(rpcURL) })

  try {
    // Estimate the transaction gas to avoid sending a malformed transaction to the providers
    await client.estimateGas({
      account: transactionData.from.toLowerCase() as `0x${string}`,
      to: transactionData.params[0].toLowerCase() as `0x${string}`,
      data: transactionData.params[1] as `0x${string}`,
    })
  } catch (error) {
    metrics.increment('dcl_error_simulate_transaction')
    throw new SimulateTransactionError(
      isErrorWithMessage(error) ? error.message : 'Error simulating transaction'
    )
  }
}
