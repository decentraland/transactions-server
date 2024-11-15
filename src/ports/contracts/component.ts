import { ChainId, ChainName, getChainName } from '@dcl/schemas'
import { AppComponents } from '../../types'
import {
  IContractsComponent,
  ContractsResponse,
  RemoteCollection,
} from './types'

export async function createContractsComponent(
  components: Pick<AppComponents, 'config' | 'fetcher' | 'collectionsSubgraph'>
): Promise<IContractsComponent> {
  let collectionAddresses: string[] = []
  let whitelistedAddresses: string[] = []
  let lastFetch: number = Date.now()

  const {
    config,
    collectionsSubgraph,
    fetcher: { fetch },
  } = components

  const contractAddressesURL = await config.requireString(
    'CONTRACT_ADDRESSES_URL'
  )
  const collectionsFetchInterval = await config.requireNumber(
    'COLLECTIONS_FETCH_INTERVAL_MS'
  )
  const chainId = await config.requireNumber('COLLECTIONS_CHAIN_ID')
  const chainName = await getRemoteContractURLChainName(chainId)

  // Methods
  async function isValidAddress(address: string): Promise<boolean> {
    const validations = await Promise.all([
      isCollectionAddress(address.toLowerCase()),
      isWhitelisted(address.toLowerCase()),
    ])
    return validations.some((isValid) => isValid)
  }

  async function isWhitelisted(address: string): Promise<boolean> {
    if (
      whitelistedAddresses.length === 0 ||
      isOlderThan(lastFetch, collectionsFetchInterval)
    ) {
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

      whitelistedAddresses = Object.values(
        contractAddresses[chainName.toLowerCase()] ?? {}
      ).map((contractAddress) => contractAddress.toLowerCase())
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
    }>(getCollectionQuery(), { id: address })

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

  return {
    isValidAddress,
    isCollectionAddress,
    isWhitelisted,
    getCollectionQuery,
    clearCache,
  }
}

async function getRemoteContractURLChainName(
  chainId: ChainId
): Promise<string> {
  let chainName = await getCollectionChainName(chainId)

  // The collections json we're dealing with, has `matic` as a name for matic mainnet instead of `polygon` and names as lowercase,
  // so we need to account for those here
  if (chainName === ChainName.MATIC_MAINNET) {
    chainName = 'matic' as ChainName
  }
  return chainName.toLowerCase()
}

async function getCollectionChainName(chainId: ChainId): Promise<ChainName> {
  if (!ChainId.validate(chainId)) {
    throw new Error(`Invalid chainId ${chainId}`)
  }

  return getChainName(chainId)!
}

function isOlderThan(timestamp: number, intervalInMs: number): boolean {
  return Date.now() - timestamp > intervalInMs
}
