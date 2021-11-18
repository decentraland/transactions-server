import { Network } from '@dcl/schemas'
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
  const network = await getNetwork(components)

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

  const whitelistedAddresses = Object.values(contractAddresses[network]).map(
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

async function getNetwork(
  components: Pick<AppComponents, 'config'>
): Promise<Network> {
  const { config } = components

  const network = await config.requireString('NETWORK')

  if (!Network.validate(network)) {
    throw new Error(`Invalid network ${network}`)
  }

  return network
}
