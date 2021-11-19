import { ChainId, ChainName, getChainName } from '@dcl/schemas'
import { AppComponents } from '../../types'
import { IContractsComponent, ContractsResponse } from './types'

let whitelistedAddresses: string[] = []
let lastFetch: number = Date.now()

export function createContractsComponent(
  components: Pick<AppComponents, 'config' | 'fetcher' | 'logs'>
): IContractsComponent {
  const {
    config,
    fetcher: { fetch },
    logs,
  } = components

  const logger = logs.getLogger('contract-component')

  // Methods
  async function isWhitelisted(address: string): Promise<boolean> {
    if (whitelistedAddresses.length === 0 || isOlderThanAnHour(lastFetch)) {
      const contractAddressesURL = await config.requireString(
        'CONTRACT_ADDRESSES_URL'
      )
      const chainId = await config.requireNumber('COLLECTIONS_CHAIN_ID')
      const chainName = await getCollectionChainName(chainId)

      logger.log(
        `Fetching whitelisted contract addresses from ${contractAddressesURL} for chain ${chainName}`
      )

      const remoteResult = await fetch(contractAddressesURL, {
        headers: { 'content-type': 'application/json' },
        method: 'GET',
      })

      if (!remoteResult.ok) {
        throw new Error(
          `Could not get the whitelisted addresses from ${contractAddressesURL}`
        )
      }

      const contractAddresses: ContractsResponse = await remoteResult.json()

      whitelistedAddresses = Object.values(contractAddresses[chainName]).map(
        (contractAddress) => contractAddress.toLowerCase()
      )
      lastFetch = Date.now()
    }

    return whitelistedAddresses.includes(address.toLowerCase())
  }

  return {
    isWhitelisted,
  }
}

async function getCollectionChainName(chainId: ChainId): Promise<ChainName> {
  if (!ChainId.validate(chainId)) {
    throw new Error(`Invalid chainId ${chainId}`)
  }

  const chainName = getChainName(chainId)!
  return chainName.toLowerCase() as ChainName
}

function isOlderThanAnHour(timestamp: number) {
  return Date.now() - timestamp > 3600000 // an hour in ms
}
