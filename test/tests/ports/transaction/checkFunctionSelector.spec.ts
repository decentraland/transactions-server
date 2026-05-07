import { encodeFunctionData, Hex, parseAbi } from 'viem'
import { IMetricsComponent } from '@well-known-components/interfaces'
import { metricDeclarations } from '../../../../src/metrics'
import { checkFunctionSelector } from '../../../../src/ports/transaction/validation/checkFunctionSelector'
import { IRelayRouterComponent } from '../../../../src/ports/relay-router/types'
import {
  InvalidFunctionSelectorError,
  SelfRelayUserAddressError,
} from '../../../../src/types/transactions/errors'
import { TransactionData } from '../../../../src/types/transactions/transactions'
import TransactionDataMock from '../../../mocks/transactionData'

const META_TX_ABI = parseAbi([
  'function executeMetaTransaction(address userAddress, bytes functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) returns (bytes)',
  'function executeMetaTransaction(address userAddress, bytes functionData, bytes signature) returns (bytes)',
])

let components: {
  metrics: IMetricsComponent<keyof typeof metricDeclarations>
  relayer: Pick<IRelayRouterComponent, 'getRelayerAddresses'>
}
let incrementMock: jest.Mock
let getRelayerAddressesMock: jest.Mock

beforeEach(() => {
  incrementMock = jest.fn()
  getRelayerAddressesMock = jest.fn().mockResolvedValue(new Set<string>())
  components = {
    metrics: {
      increment: incrementMock,
    } as unknown as IMetricsComponent<keyof typeof metricDeclarations>,
    relayer: {
      getRelayerAddresses: getRelayerAddressesMock,
    },
  }
})

describe('when checking the function selector', () => {
  describe('and the calldata is a valid legacy executeMetaTransaction call (0x0c53c51c)', () => {
    it.each(
      Object.entries(TransactionDataMock).map(([name, txn]) => [name, txn])
    )(
      'should resolve and not increment the rejection counter for %s',
      async (_name, txn) => {
        await expect(
          checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            txn as TransactionData
          )
        ).resolves.not.toThrow()
        expect(incrementMock).not.toHaveBeenCalled()
      }
    )
  })

  describe('and the calldata is a valid OffChainMarketplace executeMetaTransaction call (0xd8ed1acc)', () => {
    let transactionData: TransactionData

    beforeEach(() => {
      // Real amoy txn: executeMetaTransaction(address,bytes,bytes) wrapping an accept call
      transactionData = {
        from: '0x2a39d4f68133491f0442496f601cde2a945b6d31',
        params: [
          '0x1b67d0e31eeb6b52d8eeed71d3616c2f5b33b8e7',
          '0xd8ed1acc0000000000000000000000002a39d4f68133491f0442496f601cde2a945b6d310000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000056400000000000000000000000000000000000000000000000000000000000004e4961a547e0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000004274c2545f2263f820f4e5dc19cca999c955238c00000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000003800000000000000000000000000000000000000000000000000000000000000041628fd22e2aa963e401cc099f780dca49dfd2ff0efc9c8637a0dcbc53eb95214f16004349ae0e961f75c01cbd2e2a24a631f72afdce537aeb19c89676a87a29861c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000032000000000000000000000000000000000000000000000000000000006bad93800000000000000000000000000000000000000000000000000000000069cd1195000000000000000000000000000000000000000000000000000000784f4e1e7e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000400000000000000000000000081004ea82f4af8337e357bef49cc746fce881dee00000000000000000000000000000000000000000000000000000000000000060000000000000000000000002a39d4f68133491f0442496f601cde2a945b6d3100000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000007ad72b9f944ea9793cf4055d88f81138cc2c63a00000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000004274c2545f2263f820f4e5dc19cca999c955238c00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041066410a393ce9de0ea390bd96ca446656d1ca607a1d93b3a6b4f4ba83e4eee8e70a9ca190f76adfcc9fb1f3152dc64761699852b61c82c81c44d9822f5d105d11c00000000000000000000000000000000000000000000000000000000000000',
        ],
      }
    })

    it('should resolve and not increment the rejection counter', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).resolves.not.toThrow()
      expect(incrementMock).not.toHaveBeenCalled()
    })
  })

  describe('and the calldata uses a non-executeMetaTransaction selector', () => {
    let transactionData: TransactionData

    beforeEach(() => {
      // 0xa9059cbb is ERC20 transfer(address,uint256)
      transactionData = {
        from: '0xe539E0AED3C1971560517D58277f8dd9aC296281',
        params: [
          '0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0',
          '0xa9059cbb' + '00'.repeat(64),
        ],
      }
    })

    it('should throw InvalidFunctionSelectorError', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).rejects.toThrow(InvalidFunctionSelectorError)
    })

    it('should increment the rejection counter and surface the offending selector on the error', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).rejects.toMatchObject({ selector: '0xa9059cbb' })

      expect(incrementMock).toHaveBeenCalledWith(
        'dcl_error_invalid_function_selector'
      )
    })
  })

  describe('and the calldata is empty', () => {
    let transactionData: TransactionData

    beforeEach(() => {
      transactionData = {
        from: '0xe539E0AED3C1971560517D58277f8dd9aC296281',
        params: ['0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0', '0x'],
      }
    })

    it('should throw InvalidFunctionSelectorError', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).rejects.toThrow(InvalidFunctionSelectorError)
    })

    it('should increment the rejection counter and surface the truncated slice on the error', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).rejects.toMatchObject({ selector: '0x' })

      expect(incrementMock).toHaveBeenCalledWith(
        'dcl_error_invalid_function_selector'
      )
    })
  })

  describe('and the calldata is shorter than the 4-byte selector', () => {
    let transactionData: TransactionData

    beforeEach(() => {
      transactionData = {
        from: '0xe539E0AED3C1971560517D58277f8dd9aC296281',
        params: ['0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0', '0x0c'],
      }
    })

    it('should throw InvalidFunctionSelectorError', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).rejects.toThrow(InvalidFunctionSelectorError)
    })
  })

  describe('and the selector matches but the body is truncated', () => {
    let transactionData: TransactionData

    beforeEach(() => {
      // Right selector, but body is way shorter than the expected 5 args (160 bytes minimum)
      transactionData = {
        from: '0xe539E0AED3C1971560517D58277f8dd9aC296281',
        params: [
          '0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0',
          '0x0c53c51c' + 'ff'.repeat(10),
        ],
      }
    })

    it('should throw InvalidFunctionSelectorError', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).rejects.toThrow(InvalidFunctionSelectorError)
    })

    it('should increment the rejection counter and surface the matching selector on the error', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).rejects.toMatchObject({ selector: '0x0c53c51c' })

      expect(incrementMock).toHaveBeenCalledWith(
        'dcl_error_invalid_function_selector'
      )
    })
  })

  describe('and the selector is in mixed case', () => {
    let transactionData: TransactionData

    beforeEach(() => {
      // viem accepts mixed-case hex; the selector surfaced on the error should be normalized to lowercase
      transactionData = {
        from: '0xe539E0AED3C1971560517D58277f8dd9aC296281',
        params: [
          '0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0',
          '0xA9059CBB' + '00'.repeat(64),
        ],
      }
    })

    it('should normalize the selector on the error to lowercase', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).rejects.toMatchObject({ selector: '0xa9059cbb' })
    })
  })

  describe('and the userAddress matches one of the relayer EOAs', () => {
    const RELAYER_EOA = '0xaaaa1111aaaa2222aaaa3333aaaa4444aaaa5555'
    const CONTRACT = '0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0'

    describe('and the calldata uses the legacy split-sig overload (0x0c53c51c)', () => {
      let transactionData: TransactionData

      beforeEach(() => {
        getRelayerAddressesMock.mockResolvedValueOnce(
          new Set([RELAYER_EOA.toLowerCase()])
        )
        transactionData = {
          from: '0xe539E0AED3C1971560517D58277f8dd9aC296281',
          params: [
            CONTRACT,
            encodeFunctionData({
              abi: META_TX_ABI,
              functionName: 'executeMetaTransaction',
              args: [
                RELAYER_EOA,
                ('0x095ea7b3' + '00'.repeat(64)) as Hex,
                `0x${'00'.repeat(32)}` as Hex,
                `0x${'00'.repeat(32)}` as Hex,
                27,
              ],
            }),
          ],
        }
      })

      it('should reject with a SelfRelayUserAddressError', async () => {
        await expect(
          checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            transactionData
          )
        ).rejects.toThrow(SelfRelayUserAddressError)
      })

      it('should surface the offending userAddress on the error', async () => {
        await expect(
          checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            transactionData
          )
        ).rejects.toMatchObject({ userAddress: RELAYER_EOA.toLowerCase() })
      })

      it('should increment the self-relay rejection counter without labels', async () => {
        await expect(
          checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            transactionData
          )
        ).rejects.toThrow()
        expect(incrementMock).toHaveBeenCalledWith(
          'dcl_error_self_relay_user_address'
        )
        expect(incrementMock).toHaveBeenCalledTimes(1)
      })

      it('should not leak the relayer EOA or the word "relayer" in the public message', async () => {
        let caught: unknown
        try {
          await checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            transactionData
          )
        } catch (err) {
          caught = err
        }

        expect(caught).toBeInstanceOf(SelfRelayUserAddressError)
        const message = (
          caught as SelfRelayUserAddressError
        ).message.toLowerCase()
        expect(message).not.toContain('relayer')
        expect(message).not.toContain(RELAYER_EOA.toLowerCase())
      })
    })

    describe('and the calldata uses the combined-sig overload (0xd8ed1acc)', () => {
      let transactionData: TransactionData

      beforeEach(() => {
        getRelayerAddressesMock.mockResolvedValueOnce(
          new Set([RELAYER_EOA.toLowerCase()])
        )
        transactionData = {
          from: '0xe539E0AED3C1971560517D58277f8dd9aC296281',
          params: [
            CONTRACT,
            encodeFunctionData({
              abi: META_TX_ABI,
              functionName: 'executeMetaTransaction',
              args: [
                RELAYER_EOA,
                ('0x095ea7b3' + '00'.repeat(64)) as Hex,
                '0xdeadbeef',
              ],
            }),
          ],
        }
      })

      it('should reject with a SelfRelayUserAddressError', async () => {
        await expect(
          checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            transactionData
          )
        ).rejects.toThrow(SelfRelayUserAddressError)
      })
    })
  })

  describe('and the userAddress does not match any relayer EOA', () => {
    let transactionData: TransactionData

    beforeEach(() => {
      getRelayerAddressesMock.mockResolvedValueOnce(
        new Set(['0xaaaa1111aaaa2222aaaa3333aaaa4444aaaa5555'])
      )
      transactionData = TransactionDataMock.approveMana
    })

    it('should resolve and not increment the self-relay counter', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).resolves.not.toThrow()
      expect(incrementMock).not.toHaveBeenCalled()
    })
  })

  describe('and the relayer address set is empty (provider unavailable or Gelato-only)', () => {
    let transactionData: TransactionData

    beforeEach(() => {
      getRelayerAddressesMock.mockResolvedValueOnce(new Set<string>())
      transactionData = TransactionDataMock.approveMana
    })

    it('should resolve without checking userAddress', async () => {
      await expect(
        checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
      ).resolves.not.toThrow()
      expect(incrementMock).not.toHaveBeenCalled()
    })
  })
})

// These tests document specific attack shapes the guard prevents. Each scenario
// describes how an attacker could have drained the relayer before the guard
// existed: by crafting calldata where the relayer (msg.sender on the broadcast)
// is the authorized actor for a value-moving or privilege-escalating call.
// Wrapping in executeMetaTransaction would strip the relayer's identity via the
// meta-tx pattern; raw calls bypass that protection — which is why we reject
// any calldata whose 4-byte selector isn't an executeMetaTransaction overload.
describe('when the selector matches a known drain attack', () => {
  const RELAYER_ALLOWLISTED_CONTRACT =
    '0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0' // MANAToken on amoy
  const ATTACKER = '0x1111111111111111111111111111111111111111'
  const VICTIM = '0x2222222222222222222222222222222222222222'
  const SOMEONE_ELSE = '0x3333333333333333333333333333333333333333'

  // padded for ABI encoding: 12 zero bytes + 20-byte address
  const padAddr = (addr: string) =>
    '000000000000000000000000' + addr.slice(2).toLowerCase()
  const MAX_UINT256 = 'f'.repeat(64)
  const SOME_AMOUNT =
    '00000000000000000000000000000000000000000000003635c9adc5dea00000' // 1000 ether

  type Scenario = {
    label: string
    selector: string
    data: string
  }

  const scenarios: Scenario[] = [
    {
      label:
        "attacker crafts ERC20.transfer to move the relayer's tokens to themselves",
      selector: '0xa9059cbb',
      data: '0xa9059cbb' + padAddr(ATTACKER) + SOME_AMOUNT,
    },
    {
      label:
        "attacker crafts ERC20.approve to grant themselves an unlimited allowance on the relayer's tokens",
      selector: '0x095ea7b3',
      data: '0x095ea7b3' + padAddr(ATTACKER) + MAX_UINT256,
    },
    {
      label:
        'attacker crafts ERC20.transferFrom assuming the relayer previously approved someone',
      selector: '0x23b872dd',
      data:
        '0x23b872dd' + padAddr(SOMEONE_ELSE) + padAddr(ATTACKER) + SOME_AMOUNT,
    },
    {
      label:
        'attacker crafts Ownable.transferOwnership to take over a contract where the relayer is owner',
      selector: '0xf2fde38b',
      data: '0xf2fde38b' + padAddr(ATTACKER),
    },
    {
      label:
        'attacker submits a multicall to batch several drain operations in one tx',
      // multicall(bytes[]) — empty array, just enough to reach the contract
      selector: '0xac9650d8',
      data:
        '0xac9650d8' +
        '0000000000000000000000000000000000000000000000000000000000000020' +
        '0000000000000000000000000000000000000000000000000000000000000000',
    },
    {
      label:
        "attacker triggers a contract's fallback function via a random unknown selector",
      selector: '0xdeadbeef',
      data: '0xdeadbeef' + '00'.repeat(60),
    },
    {
      label:
        'attacker pretends to call executeMetaTransaction but flips one selector byte (typosquat)',
      // 0x0c53c51d (last nibble bumped from c to d) — visually similar, totally different function
      selector: '0x0c53c51d',
      data: '0x0c53c51d' + '00'.repeat(160),
    },
    {
      label: "attacker submits a victim's calldata to a non-MANA contract",
      // direct executeOrder() call without the executeMetaTransaction wrapper
      // executeOrder(address,uint256,uint256) selector = 0xae7b0333
      selector: '0xae7b0333',
      data: '0xae7b0333' + padAddr(VICTIM) + SOME_AMOUNT + SOME_AMOUNT,
    },
  ]

  it.each(scenarios)(
    'should reject with InvalidFunctionSelectorError and increment the rejection counter ($label)',
    async ({ selector, data }) => {
      const transactionData: TransactionData = {
        from: ATTACKER,
        params: [RELAYER_ALLOWLISTED_CONTRACT, data],
      }

      const error = await checkFunctionSelector(
        components as Parameters<typeof checkFunctionSelector>[0],
        transactionData
      ).catch((err) => err)

      expect(error).toBeInstanceOf(InvalidFunctionSelectorError)
      expect((error as InvalidFunctionSelectorError).selector).toBe(selector)
      expect(incrementMock).toHaveBeenCalledWith(
        'dcl_error_invalid_function_selector'
      )
    }
  )
})
