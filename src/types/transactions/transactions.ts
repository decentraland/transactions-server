import { ChainId } from '@dcl/schemas'

export interface IMetaTransactionProviderComponent {
  sendMetaTransaction(transactionData: TransactionData): Promise<string>
  getNetworkGasPrice(chainId: ChainId): Promise<bigint | null>
}

export type TransactionData = {
  from: string
  params: [string, string] // manaAddress, txData
}
