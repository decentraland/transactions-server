import { IDatabase } from '@well-known-components/interfaces'

export type TransactionData = {
  from: string
  to: string
  params: string[]
}

export type MetaTransactionRequest = TransactionData & {
  apiId: string
}

export type MetaTransactionResponse = {
  txHash?: string
  log: string
  flag: number
  code?: number
  message?: string
}

export type TransactionRow = {
  id: number
  txHash: string
  userAddress: string
  contractAddress: string
  createdAt: Date
}

export interface ITransactionComponent {
  sendMetaTransaction: (
    transactionData: TransactionData
  ) => Promise<MetaTransactionResponse>

  getByUserAddress: (
    userAddress: string
  ) => Promise<IDatabase.IQueryResult<TransactionRow>>

  checkTransactionData: (transactionData: TransactionData) => Promise<void>
}
