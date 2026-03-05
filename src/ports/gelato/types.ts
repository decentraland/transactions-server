import { IMetaTransactionProviderComponent } from '../../types/transactions/transactions'

export type GelatoMetaTransactionComponent = IMetaTransactionProviderComponent
export type GelatoSponsoredCallResponse = {
  taskId: string
}

export enum TaskStatus {
  Pending = 100,
  Submitted = 110,
  Included = 200,
  Rejected = 400,
  Reverted = 500,
}

export type GelatoJsonRpcResponse<T> = {
  jsonrpc: string
  id: number
  result?: T
  error?: {
    code: number
    message: string
  }
}

export type GelatoTaskStatusResult = {
  chainId: number
  createdAt: number
  status: TaskStatus
  transactionHash?: string
  receipt?: {
    transactionHash: string
    blockNumber: number
    gasUsed: string
    effectiveGasPrice: string
  }
  error?: string
  errorData?: string
}
