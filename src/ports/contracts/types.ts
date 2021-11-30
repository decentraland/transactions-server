export interface IContractsComponent {
  isValidContractAddress(address: string): Promise<boolean>
  isCollectionAddress(address: string): Promise<boolean>
  isWhitelisted(address: string): Promise<boolean>
  getCollectionQuery(): string
  clearCache(): void
}

export type ContractsResponse = Record<string, string> // Record<ChainName, string>
export type RemoteCollection = { id: string }
