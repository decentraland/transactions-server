import { providers } from 'ethers'
import { ITransactionValidator } from './types'

export const checkTransaction: ITransactionValidator = async (
  components,
  transactionData
) => {
  const { config } = components
  const rpcURL = await config.requireString('RPC_URL')

  const provider = new providers.JsonRpcProvider(rpcURL)

  // Estimage Transaction Gas to avoid send a transaction malformed to the providers
  await provider.estimateGas(transactionData)
}
