import { ChainId, ChainName, getChainName } from '@dcl/schemas'
import { AppComponents } from '../types'
import { ContractsResponse } from '../types/contracts'

const getCollectionQuery = `
  query getCollection($id: String!) {
    collections(where: { id: $id }, first: 1) {
      id
    }
  }
`

export async function isValidContractAddress(
  components: Pick<AppComponents, 'config' | 'fetcher' | 'collectionsSubgraph'>,
  address: string
): Promise<boolean> {
  return (
    (await isCollectionAddress(components, address)) ||
    (await isWhitelisted(components, address))
  )
}

async function isCollectionAddress(
  components: Pick<AppComponents, 'config' | 'collectionsSubgraph'>,
  address: string
): Promise<boolean> {
  const { collectionsSubgraph } = components

  const { collections } = await collectionsSubgraph.query<{
    collections: { id: string }[]
  }>(getCollectionQuery, { id: address })

  return collections.length >= 1
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

async function getCollectionChainName(
  components: Pick<AppComponents, 'config'>
): Promise<ChainName> {
  const { config } = components

  const chainId = await config.requireNumber('COLLECTIONS_CHAIN_ID')

  if (!ChainId.validate(chainId)) {
    throw new Error(`Invalid chainId ${chainId}`)
  }

  const chainName = getChainName(chainId)!
  return chainName.toLowerCase() as ChainName
}
