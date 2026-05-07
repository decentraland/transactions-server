import { parseAbi } from 'viem'

// Two executeMetaTransaction overloads exist across DCL contracts:
//   0x0c53c51c — legacy split-sig (MarketplaceV2, MANA, collections)
//   0xd8ed1acc — combined-sig (OffChainMarketplace)
// Both share `userAddress` as the first argument and place the inner call
// payload at args[1].
export const META_TX_ABI = parseAbi([
  'function executeMetaTransaction(address userAddress, bytes functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) returns (bytes)',
  'function executeMetaTransaction(address userAddress, bytes functionData, bytes signature) returns (bytes)',
])
