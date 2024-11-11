import { IMetaTransactionProviderComponent } from '../../types/transactions/transactions'

export type GelatoMetaTransactionComponent = IMetaTransactionProviderComponent
export type GelatoSponsoredCallResponse = {
  taskId: string
}

export enum TaskState {
  CheckPending = 'CheckPending',
  ExecPending = 'ExecPending',
  WaitingForConfirmation = 'WaitingForConfirmation',
  ExecSuccess = 'ExecSuccess',
  ExecReverted = 'ExecReverted',
  Cancelled = 'Cancelled',
}
export type GelatoTaskStatusResponse = {
  task: {
    chainId: number
    taskId: string
    taskState: TaskState
    creationDate: string
    lastCheckDate?: string
    lastCheckMessage?: string
    transactionHash?: string
    blockNumber?: number
    executionDate?: string
    gasUsed?: string
    effectiveGasPrice?: string
  }
}
