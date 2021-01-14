import { IDatabase } from '@well-known-components/interfaces'

export type TransactionData = {
  userAddress: string
  to: string
  params: string[]
}

export type MetaTransactionRequest = TransactionData & {
  apiId: string
}

export type MetaTransactionResponse = {
  txHash: string
  log: string
  flag: number
}

export type TransactionRow = {
  id: number
  txHash: string
  userAddress: string
  contractAddress: string
  ip: string
  createdAt: Date
}

export interface ITransactionComponent {
  sendMetaTransaction: (
    transactionData: TransactionData
  ) => Promise<MetaTransactionResponse>

  getByUserAddress: (
    userAddress: string
  ) => Promise<IDatabase.IQueryResult<TransactionRow>>

  isValidTransactionData: (transactionData: TransactionData) => Promise<boolean>
}
