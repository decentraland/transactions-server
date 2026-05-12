import { encodeFunctionData, parseAbi, parseUnits, zeroAddress } from 'viem'
import { ChainId } from '@dcl/schemas'
import { ContractName, getContract } from 'decentraland-transactions'
import { getSalePrice } from '../../../../src/ports/transaction/validation/checkSalePrice'
import type { TransactionData } from '../../../../src/types/transactions'
import type { Abi, Hex } from 'viem'

describe('getSalePrice', () => {
  let params: TransactionData['params']

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('when getting the sale price for a store buy', () => {
    beforeEach(() => {
      params = [
        '0x6ddF1b1924DAD850AdBc1C02026535464Be06B0c',
        '0x0c53c51c0000000000000000000000001d9aa2025b67f0f21d1603ce521bda7869098f8a00000000000000000000000000000000000000000000000000000000000000a0cd75d528f0f890bb3e1c602c0d6594ef6a1d44de54be0e3d40bea6b960efa73f5f94e236aff853375a3914979b4b62d0b4475738a05ede0b12bfda47a3cd085a000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000001a4a4fdc78a00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000052c98c80a5aad12056596d3b2dd4139c327bc501000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000008ac7230489e8000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000001d9aa2025b67f0f21d1603ce521bda7869098f8a00000000000000000000000000000000000000000000000000000000',
      ]
    })

    it('should return the supplied sale price for the meta transaction', () => {
      expect(getSalePrice(params, ChainId.MATIC_MUMBAI)).toEqual(
        parseUnits('10', 18).toString()
      )
    })
  })

  describe('when getting the sale price for a marketplace buy', () => {
    beforeEach(() => {
      params = [
        '0x5A467398dfa9d5C663a656423A2D055f538198A4',
        '0x0c53c51c0000000000000000000000001d9aa2025b67f0f21d1603ce521bda7869098f8a00000000000000000000000000000000000000000000000000000000000000a0209754a27744d91f453575a6acffdafa8bb33e89ca1234cf35552ae9e7f2dd944bca94fc1fa2e344c6c8f69780585fd084edf059f96a7eef27a970a98f536de1000000000000000000000000000000000000000000000000000000000000001b0000000000000000000000000000000000000000000000000000000000000064ae7b03330000000000000000000000005c8bf33e673dc712ba62c5459e59dd9a15d458ff000000000000000000000000000000000000000000000000000000000000000b00000000000000000000000000000000000000000000003635c9adc5dea0000000000000000000000000000000000000000000000000000000000000',
      ]
    })

    it('should return the supplied sale price for the meta transaction', () => {
      expect(getSalePrice(params, ChainId.MATIC_MUMBAI)).toEqual(
        parseUnits('1000', 18).toString()
      )
    })
  })

  describe('when getting the sale price for a place bid', () => {
    beforeEach(() => {
      params = [
        '0x78Dd92c8941dBC7BE54E2a9390D58aD28AD97afD',
        '0x0c53c51c0000000000000000000000001d9aa2025b67f0f21d1603ce521bda7869098f8a00000000000000000000000000000000000000000000000000000000000000a08a996249f9e3327542a5ba864743646281b162e8a9cd6c0b29958dce67fb64270804371ef347dd8c128194860ced11ee6e2d339ebda48738f5e036b9a803f53c000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000008481281be80000000000000000000000005c8bf33e673dc712ba62c5459e59dd9a15d458ff000000000000000000000000000000000000000000000000000000000000000b000000000000000000000000000000000000000000000001158e460913d000000000000000000000000000000000000000000000000000000000000000269e1000000000000000000000000000000000000000000000000000000000',
      ]
    })

    it('should return the supplied sale price for the meta transaction', () => {
      expect(getSalePrice(params, ChainId.MATIC_MUMBAI)).toEqual(
        parseUnits('20', 18).toString()
      )
    })
  })

  describe('when decoding an empty contract function', () => {
    beforeEach(() => {
      params = ['', '']
    })

    it('should return null', () => {
      expect(getSalePrice(params, ChainId.MATIC_MUMBAI)).toEqual(null)
    })
  })

  describe('and the executeMetaTransaction wrapper fails to decode for a registered sale contract', () => {
    beforeEach(() => {
      // BidV2 address with an off-by-one selector (0x0a... instead of 0x0c...)
      // so the outer wrapper decode throws.
      params = [
        '0x78Dd92c8941dBC7BE54E2a9390D58aD28AD97afD',
        '0x0a53c51c0000000000000000000000001d9aa2025b67f0f21d1603ce521bda7869098f8a00000000000000000000000000000000000000000000000000000000000000a08a996249f9e3327542a5ba864743646281b162e8a9cd6c0b29958dce67fb64270804371ef347dd8c128194860ced11ee6e2d339ebda48738f5e036b9a803f53c000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000008481281be80000000000000000000000005c8bf33e673dc712ba62c5459e59dd9a15d458ff000000000000000000000000000000000000000000000000000000000000000b000000000000000000000000000000000000000000000001158e460913d000000000000000000000000000000000000000000000000000000000000000269e1000000000000000000000000000000000000000000000000000000000',
      ]
    })

    it('should return "0"', () => {
      expect(getSalePrice(params, ChainId.MATIC_MUMBAI)).toEqual('0')
    })
  })

  describe('and the inner sale-call decode fails for a registered sale contract', () => {
    beforeEach(() => {
      // BidV2 address. Outer wrapper is a valid executeMetaTransaction
      // (0x0c53c51c) but the inner call payload is invalid for placeBid.
      params = [
        '0x78Dd92c8941dBC7BE54E2a9390D58aD28AD97afD',
        '0x0c53c51c0000000000000000000000001d9aa2025b67f0f21d1603ce521bda7869098f8a00000000000000000000000000000000000000000000000000000000000000a08a996249f9e3327542a5ba864743646281b162e8a9cd6c0b29958dce67fb64270804371ef347dd8c128194860ced11ee6e2d339ebda48738f5e036b9a803f53c000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000',
      ]
    })

    it('should return "0"', () => {
      expect(getSalePrice(params, ChainId.MATIC_MUMBAI)).toEqual('0')
    })
  })

  describe('when getting the sale price for an off-chain marketplace accept', () => {
    const chainId = ChainId.MATIC_AMOY
    const offChain = getContract(ContractName.OffChainMarketplace, chainId)
    const userAddress = '0x1d9aa2025b67f0f21d1603ce521bda7869098f8a'

    // Combined-sig executeMetaTransaction (0xd8ed1acc) used by OffChainMarketplace.
    const META_TX_ABI = parseAbi([
      'function executeMetaTransaction(address userAddress, bytes functionData, bytes signature) returns (bytes)',
    ])

    function asset(value: bigint) {
      return {
        assetType: 0n,
        contractAddress: zeroAddress,
        value,
        beneficiary: zeroAddress,
        extra: '0x' as Hex,
      }
    }

    function trade(received: Array<ReturnType<typeof asset>>) {
      return {
        signer: zeroAddress,
        signature: '0x' as Hex,
        checks: {
          uses: 0n,
          expiration: 0n,
          effective: 0n,
          salt: ('0x' + '00'.repeat(32)) as Hex,
          contractSignatureIndex: 0n,
          signerSignatureIndex: 0n,
          allowedRoot: ('0x' + '00'.repeat(32)) as Hex,
          allowedProof: [] as Hex[],
          externalChecks: [] as Array<{
            contractAddress: Hex
            selector: Hex
            value: Hex
            required: boolean
          }>,
        },
        sent: [] as Array<ReturnType<typeof asset>>,
        received,
      }
    }

    function buildParams(innerCalldata: Hex): TransactionData['params'] {
      const wrapped = encodeFunctionData({
        abi: META_TX_ABI,
        functionName: 'executeMetaTransaction',
        args: [userAddress, innerCalldata, '0x' as Hex],
      })
      return [offChain.address, wrapped]
    }

    function buildAcceptCalldata(trades: Array<ReturnType<typeof trade>>): Hex {
      return encodeFunctionData({
        abi: offChain.abi as Abi,
        functionName: 'accept',
        args: [trades],
      })
    }

    describe('and a single trade carries a single received asset above the floor', () => {
      it('should return that asset value', () => {
        const value = parseUnits('5', 18)
        const params = buildParams(buildAcceptCalldata([trade([asset(value)])]))
        expect(getSalePrice(params, chainId)).toEqual(value.toString())
      })
    })

    describe('and any single trade in a batch is sub-floor', () => {
      it('should return the minimum across all received assets', () => {
        const high = parseUnits('5', 18)
        const subFloor = 1n
        const params = buildParams(
          buildAcceptCalldata([trade([asset(high)]), trade([asset(subFloor)])])
        )
        expect(getSalePrice(params, chainId)).toEqual(subFloor.toString())
      })
    })

    describe('and the trade carries no received assets', () => {
      it('should return "0" so the floor check trips', () => {
        const params = buildParams(buildAcceptCalldata([trade([])]))
        expect(getSalePrice(params, chainId)).toEqual('0')
      })
    })

    describe('and the inner accept payload is malformed', () => {
      it('should return "0"', () => {
        // Valid outer executeMetaTransaction wrapping a non-decodable accept body.
        const malformedInner = ('0x' + 'de'.repeat(100)) as Hex
        const params = buildParams(malformedInner)
        expect(getSalePrice(params, chainId)).toEqual('0')
      })
    })
  })
})
