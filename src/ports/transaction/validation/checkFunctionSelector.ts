import { decodeFunctionData, Hex, parseAbi } from 'viem'
import { InvalidFunctionSelectorError } from '../../../types/transactions/errors'
import { ITransactionValidator } from './types'

// Two executeMetaTransaction overloads exist across DCL contracts:
//   0x0c53c51c — legacy split-sig (MarketplaceV2, MANA, collections)
//   0xd8ed1acc — combined-sig (OffChainMarketplace)
const META_TX_ABI = parseAbi([
  'function executeMetaTransaction(address userAddress, bytes functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) returns (bytes)',
  'function executeMetaTransaction(address userAddress, bytes functionData, bytes signature) returns (bytes)',
])

export const checkFunctionSelector: ITransactionValidator = async (
  components,
  transactionData
) => {
  const { metrics } = components
  const data = transactionData.params[1]

  try {
    decodeFunctionData({ abi: META_TX_ABI, data: data as Hex })
  } catch {
    metrics.increment('dcl_error_invalid_function_selector')
    throw new InvalidFunctionSelectorError(data.slice(0, 10).toLowerCase())
  }
}
