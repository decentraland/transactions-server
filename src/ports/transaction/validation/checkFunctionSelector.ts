import { decodeFunctionData } from 'viem'
import { META_TX_ABI } from './abis'
import {
  InvalidFunctionSelectorError,
  SelfRelayUserAddressError,
} from '../../../types/transactions/errors'
import type { ITransactionValidator } from './types'
import type { Hex } from 'viem'

export const checkFunctionSelector: ITransactionValidator = async (
  components,
  transactionData
) => {
  const { metrics, relayer } = components
  const data = transactionData.params[1]

  // Both overloads share `userAddress` as the first argument.
  let userAddress: string
  try {
    const decoded = decodeFunctionData({ abi: META_TX_ABI, data: data as Hex })
    userAddress = (decoded.args[0] as string).toLowerCase()
  } catch {
    metrics.increment('dcl_error_invalid_function_selector')
    throw new InvalidFunctionSelectorError(data.slice(0, 10).toLowerCase())
  }

  const relayerAddresses = await relayer.getRelayerAddresses()
  if (relayerAddresses.size > 0 && relayerAddresses.has(userAddress)) {
    metrics.increment('dcl_error_self_relay_user_address')
    throw new SelfRelayUserAddressError(userAddress)
  }
}
