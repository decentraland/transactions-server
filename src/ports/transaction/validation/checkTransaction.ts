import { providers } from 'ethers'
import { isErrorWithMessage } from '../../../logic/errors'
import { SimulateTransactionError } from '../../../types/transactions/errors'
import { ITransactionValidator } from './types'

export const checkTransaction: ITransactionValidator = async (
  components,
  transactionData
) => {
  const { config, metrics } = components
  const rpcURL = await config.requireString('RPC_URL')

  const provider = new providers.JsonRpcProvider(rpcURL)

  try {
    // Estimage Transaction Gas to avoid send a transaction malformed to the providers
    await provider.estimateGas({
      from: transactionData.from.toLowerCase(),
      to: transactionData.params[0].toLowerCase(),
      data: transactionData.params[1],
    })
  } catch (error) {
    metrics.increment('dcl_error_simulate_transaction')
    throw new SimulateTransactionError(
      isErrorWithMessage(error) ? error.message : 'Error simulating transaction'
    )
  }
}
