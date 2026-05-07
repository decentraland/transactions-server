import { decodeFunctionData, Hex } from 'viem'
import { META_TX_ABI } from './abis'

/**
 * Decodes params[1] as one of the executeMetaTransaction overloads and
 * returns the userAddress argument (lowercased). Throws if the calldata
 * does not decode against either overload; callers downstream of
 * checkFunctionSelector can rely on this never throwing because that
 * validator runs first and rejects unrecognized selectors.
 */
export function extractMetaTxUserAddress(data: string): string {
  const decoded = decodeFunctionData({ abi: META_TX_ABI, data: data as Hex })
  return (decoded.args[0] as string).toLowerCase()
}
