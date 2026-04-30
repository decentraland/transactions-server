import { ChainId } from '@dcl/schemas'

export interface IMetaTransactionProviderComponent {
  sendMetaTransaction(transactionData: TransactionData): Promise<string>
  getNetworkGasPrice(chainId: ChainId): Promise<bigint | null>
  /**
   * Returns the set of EOA addresses (lowercased) that this provider uses
   * to broadcast transactions on chain. Optional: providers that don't
   * expose their broadcaster EOAs (e.g. Gelato) may omit this method.
   */
  getRelayerAddresses?(): Promise<Set<string>>
}

export type TransactionData = {
  from: string
  params: [string, string] // manaAddress, txData
}
