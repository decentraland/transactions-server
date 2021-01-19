import { Schema } from './validation'

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

export type SendTransactionRequest = {
  transactionData: TransactionData
}

export type TransactionRow = {
  id: number
  txHash: string
  userAddress: string
  contractAddress: string
  createdAt: Date
}

export const transactionSchema: Schema<TransactionData> = {
  type: 'object',
  properties: {
    from: { type: 'string' },
    to: { type: 'string' },
    params: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: false,
  required: ['from', 'to', 'params'],
}
