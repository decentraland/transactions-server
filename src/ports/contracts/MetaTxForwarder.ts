import { ChainId } from '@dcl/schemas'
import { MetaTxForwarder } from './abis/MetaTxForwarder'

export const metaTxForwarder = {
  [ChainId.MATIC_MAINNET]: {
    version: '1',
    abi: MetaTxForwarder,
    address: '0x0baBda04f62C549A09EF3313Fe187f29c099FF3C',
    name: 'MetaTxForwarder',
    chainId: ChainId.MATIC_MAINNET,
  },
  [ChainId.MATIC_AMOY]: {
    version: '1',
    abi: MetaTxForwarder,
    address: '0x3dd1fef020741386bf9c8d905b7e2b02a668ccda',
    name: 'MetaTxForwarder',
    chainId: ChainId.MATIC_AMOY,
  },
}

export function getMetaTxForwarder(
  chainId: ChainId.MATIC_MAINNET | ChainId.MATIC_AMOY
): typeof metaTxForwarder[ChainId.MATIC_MAINNET | ChainId.MATIC_AMOY] {
  const metaTxForwarderContract = metaTxForwarder[chainId]

  if (!metaTxForwarderContract) {
    throw new Error(`MetaTxForwarder not configured for chainId: ${chainId}`)
  }

  return metaTxForwarderContract
}
