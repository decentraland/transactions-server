import { AppComponents } from '../types'

const getCollectionQuery = `
  query getCollection($id: String!) {
    collections(where: { id: $id }, first: 1) {
      id
    }
  }
`

export async function isValidContractAddress(
  components: Pick<
    AppComponents,
    'config' | 'contracts' | 'collectionsSubgraph'
  >,
  address: string
): Promise<boolean> {
  const { contracts } = components
  const validations = await Promise.all([
    isCollectionAddress(components, address),
    contracts.isWhitelisted(address),
  ])
  return validations.some((isValid) => isValid)
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
