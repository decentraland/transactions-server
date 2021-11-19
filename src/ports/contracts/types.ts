import { ChainName } from '@dcl/schemas'

export interface IContractsComponent {
  isWhitelisted(address: string): Promise<boolean>
}

export type ContractsResponse = Record<ChainName, string>
