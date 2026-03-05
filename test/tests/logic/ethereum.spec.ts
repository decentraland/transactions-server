import { ChainId, ChainName } from '@dcl/schemas'
import { ContractName, getContract } from 'decentraland-transactions'
import {
  decodeFunctionData,
  getMaticChainIdFromChainName,
} from '../../../src/logic/ethereum'


describe('getMaticChainIdFromNetwork', () => {
  describe('when using a valid chain name', () => {
    it('should return the mapped MAINNET Matic Chain Id for ETHEREUM MAINNET', () => {
      expect(getMaticChainIdFromChainName(ChainName.ETHEREUM_MAINNET)).toBe(
        ChainId.MATIC_MAINNET
      )
    })

    it('should return the mapped AMOY Matic Chain Id for ETHEREUM SEPOLIA', () => {
      expect(getMaticChainIdFromChainName(ChainName.ETHEREUM_SEPOLIA)).toBe(
        ChainId.MATIC_AMOY
      )
    })
  })

  describe('when using an unsupported chain name', () => {
    it('should throw with an error explaining the lack of a mapping', () => {
      expect(() =>
        getMaticChainIdFromChainName('Something' as ChainName)
      ).toThrow(
        "The chain name Something doesn't have a matic chain id to map to"
      )
    })
  })
})

describe('decodeFunctionData', () => {
  const txData =
    '0x0c53c51c0000000000000000000000001d9aa2025b67f0f21d1603ce521bda7869098f8a00000000000000000000000000000000000000000000000000000000000000a0e9b8200260f8789fb7946507975ebec26bd12b7c25dd3d4da52a2c6b8c8470e3119591fc1e5dc84e8dce9b15237da1f89fdbe786546adb53ea05274566ebbcde000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000008481281be80000000000000000000000005c8bf33e673dc712ba62c5459e59dd9a15d458ff000000000000000000000000000000000000000000000000000000000000000b0000000000000000000000000000000000000000000000008ac7230489e80000000000000000000000000000000000000000000000000000000000000026adcc00000000000000000000000000000000000000000000000000000000'

  describe('when using a valid abi and method name for the data', () => {
    it('should decode and return the function data', () => {
      const store = getContract(
        ContractName.CollectionStore,
        ChainId.MATIC_AMOY
      )

      const result = decodeFunctionData(
        store.abi,
        'executeMetaTransaction',
        txData
      )

      // Check positional values
      expect(result[0]).toBe(
        '0x1D9aa2025b67f0F21d1603ce521bda7869098f8a'
      )
      expect(result[1]).toBe(
        '0x81281be80000000000000000000000005c8bf33e673dc712ba62c5459e59dd9a15d458ff000000000000000000000000000000000000000000000000000000000000000b0000000000000000000000000000000000000000000000008ac7230489e80000000000000000000000000000000000000000000000000000000000000026adcc'
      )
      expect(result[2]).toBe(
        '0xe9b8200260f8789fb7946507975ebec26bd12b7c25dd3d4da52a2c6b8c8470e3'
      )
      expect(result[3]).toBe(
        '0x119591fc1e5dc84e8dce9b15237da1f89fdbe786546adb53ea05274566ebbcde'
      )
      // viem returns uint8 as bigint; use Number() to avoid Jest BigInt serialization issues
      expect(Number(result[4])).toBe(28)

      // Check named properties
      expect(result.userAddress).toBe(result[0])
      expect(result.functionSignature).toBe(result[1])
      expect(result.sigR).toBe(result[2])
      expect(result.sigS).toBe(result[3])
      expect(Number(result.sigV)).toBe(Number(result[4]))
    })
  })

  describe('when using an invalid method name for the abi', () => {
    it('should throw an error showing the incorrect data', () => {
      expect(() =>
        decodeFunctionData([], 'executeMetaTransaction', txData)
      ).toThrow()
    })
  })

  describe('when using a tx data for a different method', () => {
    it('should throw an error showing the incorrect data', () => {
      expect(() =>
        decodeFunctionData(
          // prettier-ignore
          [{ inputs: [], name: 'domainSeparator', outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }], stateMutability: 'view', type: 'function' }],
          'domainSeparator',
          txData
        )
      ).toThrow()
    })
  })

  describe('when using an invalid tx data', () => {
    it('should throw an error showing the incorrect data', () => {
      const store = getContract(
        ContractName.CollectionStore,
        ChainId.MATIC_AMOY
      )
      expect(() =>
        decodeFunctionData(
          store.abi,
          'executeMetaTransaction',
          txData + 'wrong'
        )
      ).toThrow()
    })
  })
})
