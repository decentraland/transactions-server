import { ChainId, ChainName, getChainName } from '@dcl/schemas'
import { AppComponents } from '../types'
import { ContractsResponse } from '../types/contracts'

const getCollectionsQuery = `
  query getCollections {
    collections(first: 1000) {
      id
    }
  }
`

export async function isValidContractAddress(
  components: Pick<AppComponents, 'config' | 'fetcher' | 'collectionsSubgraph'>,
  address: string
): Promise<boolean> {
  return (
    (await isWhitelisted(components, address)) ||
    (await isCollectionAddress(components, address))
  )
}

async function isWhitelisted(
  components: Pick<AppComponents, 'config' | 'fetcher'>,
  address: string
): Promise<boolean> {
  const {
    config,
    fetcher: { fetch },
  } = components

  const contractAddressesURL = await config.requireString(
    'CONTRACT_ADDRESSES_URL'
  )
  const chainName = await getCollectionChainName(components)

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

  const whitelistedAddresses = Object.values(contractAddresses[chainName]).map(
    (contractAddress) => contractAddress.toLowerCase()
  )

  return whitelistedAddresses.includes(address.toLowerCase())
}

async function isCollectionAddress(
  components: Pick<AppComponents, 'config' | 'collectionsSubgraph'>,
  address: string
): Promise<boolean> {
  const { collectionsSubgraph } = components

  const { collections } = await collectionsSubgraph.query<{
    collections: { id: string; name: string }[]
  }>(getCollectionsQuery)

  return collections.some(
    ({ id: collectionAddress }) => collectionAddress === address.toLowerCase()
  )
}

async function getCollectionChainName(
  components: Pick<AppComponents, 'config'>
): Promise<ChainName> {
  const { config } = components

  const chainId = await config.requireNumber('COLLECTIONS_CHAIN_ID')

  if (!ChainId.validate(chainId)) {
    throw new Error(`Invalid chainId ${chainId}`)
  }

  return getChainName(chainId)!
}
