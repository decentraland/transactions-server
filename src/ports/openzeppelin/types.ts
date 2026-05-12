import type { IMetaTransactionProviderComponent } from '../../types/transactions/transactions'

export type OpenZeppelinMetaTransactionComponent =
  IMetaTransactionProviderComponent & {
    getRelayerAddresses(): Promise<Set<string>>
  }
