import { Schema } from './validation'

export type TransactionData = {
  from: string
  params: [string, string] // manaAddress, txData
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
  createdAt: Date
}

export const transactionSchema: Schema<TransactionData> = {
  type: 'object',
  properties: {
    from: { type: 'string' },
    params: {
      type: 'array',
      items: [{ type: 'string' }, { type: 'string' }],
      additionalItems: false,
      minItems: 2,
    },
  },
  additionalProperties: false,
  required: ['from', 'params'],
}
