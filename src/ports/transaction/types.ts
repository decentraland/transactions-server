import { IDatabase } from '@well-known-components/interfaces'
import { Schema } from '../../types/validation'
import {
  IMetaTransactionProviderComponent,
  TransactionData,
} from '../../types/transactions/transactions'

export interface ITransactionComponent
  extends Pick<IMetaTransactionProviderComponent, 'sendMetaTransaction'> {
  insert(row: Omit<TransactionRow, 'id' | 'created_at'>): Promise<void>
  getByUserAddress(
    userAddress: string
  ): Promise<IDatabase.IQueryResult<TransactionRow>>
  checkData(transactionData: TransactionData): Promise<void>
}

export type SendTransactionRequest = {
  transactionData: TransactionData
}

export type TransactionRow = {
  id: number
  tx_hash: string
  user_address: string
  created_at: Date
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
