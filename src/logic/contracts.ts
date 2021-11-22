import { AppComponents } from '../types'

const getCollectionQuery = `
  query getCollection($id: String!) {
    collections(where: { id: $id }, first: 1) {
      id
    }
  }
`

const collectionAddresses: string[] = []

export async function isValidContractAddress(
  components: Pick<
    AppComponents,
    'config' | 'contracts' | 'collectionsSubgraph'
  >,
  address: string
): Promise<boolean> {
  const { contracts } = components
  const validations = await Promise.all([
    isCollectionAddress(components, address.toLowerCase()),
    contracts.isWhitelisted(address.toLowerCase()),
  ])
  return validations.some((isValid) => isValid)
}

async function isCollectionAddress(
  components: Pick<AppComponents, 'config' | 'collectionsSubgraph'>,
  address: string
): Promise<boolean> {
  if (collectionAddresses.includes(address)) {
    return true
  }

  const { collectionsSubgraph } = components

  const { collections } = await collectionsSubgraph.query<{
    collections: { id: string }[]
  }>(getCollectionQuery, { id: address })

  if (collections.length >= 1) {
    collectionAddresses.push(collections[0].id)
    return true
  }

  return false
}
