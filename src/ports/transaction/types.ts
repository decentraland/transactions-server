import { IDatabase } from '@well-known-components/interfaces'
import { Schema } from '../../types/validation'

export interface ITransactionComponent {
  sendMetaTransaction(transactionData: TransactionData): Promise<string>
  insert(row: Omit<TransactionRow, 'id' | 'createdAt'>): Promise<void>
  getByUserAddress(
    userAddress: string
  ): Promise<IDatabase.IQueryResult<TransactionRow>>
  checkData(transactionData: TransactionData): Promise<void>
}

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
  flag: MetaTransactionStatus
  code?: MetaTransactionCode
  message?: string
}

export enum MetaTransactionStatus {
  OK = 200,
  NOT_FOUND = 404,
  CONFLICT = 409,
  EXPECTATION_FAILED = 417,
  INTERNAL_SERVER_ERROR = 500,
}

export enum MetaTransactionCode {
  DAPP_LIMIT = 150,
  USER_LIMIT = 151,
  API_LIMIT = 152,
  GAS_LIMIT = 153,
  EXPECTATION_FAILED = 417,
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
      maxItems: 2,
    },
  },
  additionalProperties: false,
  required: ['from', 'params'],
}
