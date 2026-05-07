import { IMetaTransactionProviderComponent } from '../../types/transactions/transactions'

export type ProviderName = 'gelato' | 'openzeppelin'

export type ResolvedProvider = {
  name: ProviderName
  provider: IMetaTransactionProviderComponent
}

export type IRelayRouterComponent = IMetaTransactionProviderComponent & {
  resolveProvider(): Promise<ResolvedProvider>
  /**
   * Aggregates broadcaster EOA addresses across all configured providers.
   * Always returns a Set (possibly empty).
   */
  getRelayerAddresses(): Promise<Set<string>>
}
