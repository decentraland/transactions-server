import { ChainName } from '@dcl/schemas'

export interface IContractsComponent {
  isValidContractAddress(address: string): Promise<boolean>
  isCollectionAddress(address: string): Promise<boolean>
  isWhitelisted(address: string): Promise<boolean>
  getCollectionQuery(): string
  clearCache(): void
}

export type ContractsResponse = Record<ChainName, string>
export type RemoteCollection = { id: string }
