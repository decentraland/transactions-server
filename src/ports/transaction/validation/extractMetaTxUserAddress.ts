import { decodeFunctionData, Hex, parseAbi } from 'viem'

// Two executeMetaTransaction overloads exist across DCL contracts:
//   0x0c53c51c — legacy split-sig (MarketplaceV2, MANA, collections)
//   0xd8ed1acc — combined-sig (OffChainMarketplace)
// Both share `userAddress` as the first argument.
const META_TX_ABI = parseAbi([
  'function executeMetaTransaction(address userAddress, bytes functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) returns (bytes)',
  'function executeMetaTransaction(address userAddress, bytes functionData, bytes signature) returns (bytes)',
])

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
