import { ChainId } from '@dcl/schemas'
import { BigNumber } from 'ethers'

export interface IMetaTransactionProviderComponent {
  sendMetaTransaction(transactionData: TransactionData): Promise<string>
  getNetworkGasPrice(chainId: ChainId): Promise<BigNumber | null>
}

export type TransactionData = {
  from: string
  params: [string, string] // manaAddress, txData
}
