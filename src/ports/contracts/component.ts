import { ChainId, ChainName, getChainName } from '@dcl/schemas'
import { AppComponents } from '../../types'
import {
  IContractsComponent,
  ContractsResponse,
  RemoteCollection,
} from './types'

let collectionAddresses: string[] = []
let whitelistedAddresses: string[] = []
let lastFetch: number = Date.now()

export function createContractsComponent(
  components: Pick<
    AppComponents,
    'config' | 'fetcher' | 'collectionsSubgraph' | 'logs'
  >
): IContractsComponent {
  const {
    config,
    collectionsSubgraph,
    fetcher: { fetch },
    logs,
  } = components

  const logger = logs.getLogger('contract-component')

  // Methods
  async function isValidContractAddress(address: string): Promise<boolean> {
    const validations = await Promise.all([
      component.isCollectionAddress(address.toLowerCase()),
      component.isWhitelisted(address.toLowerCase()),
    ])
    return validations.some((isValid) => isValid)
  }

  async function isWhitelisted(address: string): Promise<boolean> {
    const collectionsFetchInterval = await config.requireNumber(
      'COLLECTIONS_FETCH_INTERVAL_MS'
    )

    if (
      whitelistedAddresses.length === 0 ||
      isOlderThan(lastFetch, collectionsFetchInterval)
    ) {
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

    return whitelistedAddresses.includes(address)
  }

  async function isCollectionAddress(address: string): Promise<boolean> {
    if (collectionAddresses.includes(address)) {
      return true
    }

    const { collections } = await collectionsSubgraph.query<{
      collections: RemoteCollection[]
    }>(component.getCollectionQuery(), { id: address })

    if (collections.length >= 1) {
      collectionAddresses.push(collections[0].id)
      return true
    }

    return false
  }

  function getCollectionQuery() {
    return `query getCollection($id: String!) {
      collections(where: { id: $id }, first: 1) {
        id
      }
    }`
  }

  function clearCache() {
    collectionAddresses = []
    whitelistedAddresses = []
    lastFetch = Date.now()
  }

  const component = {
    isValidContractAddress,
    isCollectionAddress,
    isWhitelisted,
    getCollectionQuery,
    clearCache,
  }

  return component
}

async function getCollectionChainName(chainId: ChainId): Promise<ChainName> {
  if (!ChainId.validate(chainId)) {
    throw new Error(`Invalid chainId ${chainId}`)
  }

  const chainName = getChainName(chainId)!
  return chainName.toLowerCase() as ChainName
}

function isOlderThan(timestamp: number, intervalInMs: number): boolean {
  return Date.now() - timestamp > intervalInMs
}
