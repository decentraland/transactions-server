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
