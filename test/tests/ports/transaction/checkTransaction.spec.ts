import { providers } from 'ethers'
import { IConfigComponent } from '@well-known-components/interfaces'
import {
  IMetricsComponent,
  IPgComponent,
} from '@well-known-components/pg-component'
import { IContractsComponent } from '../../../../src/ports/contracts/types'
import { checkTransaction } from '../../../../src/ports/transaction/validation/checkTransaction'

let transactionData: any
let mockProvider: any
let config: IConfigComponent
let components: {
  config: IConfigComponent
  pg: IPgComponent
  contracts: IContractsComponent
  metrics: IMetricsComponent
}

beforeEach(() => {
  transactionData = {
    from: '0x1234567890abcdef1234567890abcdef12345678',
    params: ['0x1234567890abcdef1234567890abcdef12345678', '0x1'],
  }

  mockProvider = {
    estimateGas: jest.fn(),
  }

  config = {
    requireString: async () => 'http://mock-rpc-url',
    requireNumber: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
  }

  components = {
    config,
    pg: {
      query: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      streamQuery: jest.fn(),
      getPool: jest.fn(),
    },
    contracts: {
      isValidAddress: jest.fn(),
      isCollectionAddress: jest.fn(),
      isWhitelisted: jest.fn(),
      getCollectionQuery: jest.fn(),
      clearCache: jest.fn(),
    },
    metrics: { increment: jest.fn() } as unknown as IMetricsComponent,
  }

  jest
    .spyOn(providers, 'JsonRpcProvider')
    .mockImplementation(() => mockProvider)
})

describe('checkTransaction', () => {
  describe('when the transaction data is valid', () => {
    beforeEach(() => {
      mockProvider.estimateGas.mockResolvedValue('0x5208')
    })

    it('should estimate gas without throwing an error', async () => {
      await expect(
        checkTransaction(components, transactionData)
      ).resolves.not.toThrow()
      expect(mockProvider.estimateGas).toHaveBeenCalledWith({
        from: transactionData.from,
        to: transactionData.params[0],
        data: transactionData.params[1],
      })
    })
  })

  describe('when the transaction data is malformed', () => {
    beforeEach(() => {
      transactionData = {
        from: '0xonvalidAddress',
        params: ['a', 'b'],
      }
      mockProvider.estimateGas.mockRejectedValue(
        new Error('Malformed transaction')
      )
    })

    it('should throw an error', async () => {
      await expect(
        checkTransaction(components, transactionData)
      ).rejects.toThrow('Malformed transaction')
      expect(mockProvider.estimateGas).toHaveBeenCalledWith({
        from: transactionData.from.toLowerCase(),
        to: transactionData.params[0].toLowerCase(),
        data: transactionData.params[1],
      })
    })
  })
})
