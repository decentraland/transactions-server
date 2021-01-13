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

export type ITransactionComponent = {
  sendMetaTransaction: (
    transactionData: TransactionData
  ) => Promise<MetaTransactionResponse>
}
