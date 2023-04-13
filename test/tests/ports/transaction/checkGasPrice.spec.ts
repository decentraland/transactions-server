import { Response } from 'node-fetch'
import { checkGasPrice } from '../../../../src/ports/transaction/validation/checkGasPrice'
import { test } from '../../../components'
import { TransactionData } from '../../../../src/ports/transaction/types'

test('checkGasPrice component', function ({ components }) {
  const from = '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b'
  let transactionData: TransactionData

  beforeEach(() => {
    transactionData = {
      from,
      params: [
        from,
        '0x0c53c51c000000000000000000000000f7b0e5d753747f102369cc6f8f33cc3feacf7c6200000000000000000000000000000000000000000000000000000000000000a072551c70696250b6de0ec4f3255f3a9e804b06080e2e65e34ac03ea6bddf6df910b461441d1a4ac26f3848e2d65635315891e0d4b4745e02123038616be2a362000000000000000000000000000000000000000000000000000000000000001b0000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000e539e0aed3c1971560517d58277f8dd9ac296281ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000',
      ],
    }
  })

  describe('when checking the gas price for a txn', () => {
    describe('and the FF MAX_GAS_PRICE_ALLOWED_IN_WEI is turned on', () => {
      let contractsMock: jest.SpyInstance

      beforeEach(() => {
        const { contracts, features } = components
        jest.spyOn(features, 'getIsFeatureEnabled').mockResolvedValueOnce(true)
        contractsMock = jest
          .spyOn(contracts, 'isCollectionAddress')
          .mockResolvedValueOnce(false)
      })

      describe('and the max gas price allowed is defined', () => {
        beforeEach(() => {
          const { features } = components
          jest.spyOn(features, 'getFeatureVariant').mockResolvedValueOnce({
            name: 'max-gas-price-allowed-in-wei',
            payload: {
              type: 'string',
              value: '2000000000',
            },
            enabled: true,
          })
        })

        describe('and the current network gas price is lower than max gas price allowed', () => {
          beforeEach(() => {
            const { fetcher } = components
            jest.spyOn(fetcher, 'fetch').mockResolvedValueOnce({
              ok: true,
              json: jest.fn().mockResolvedValueOnce({
                gasPrice: {
                  unit: 'gwei',
                  value: 1,
                },
              }),
            } as unknown as Response)
          })

          it('should not throw an error', async () => {
            await expect(
              checkGasPrice(components, transactionData)
            ).resolves.not.toThrow()
          })
        })

        describe('and the current network gas price is greater than max gas price allowed', () => {
          beforeEach(() => {
            const { fetcher } = components
            jest.spyOn(fetcher, 'fetch').mockResolvedValueOnce({
              ok: true,
              json: jest.fn().mockResolvedValueOnce({
                gasPrice: {
                  unit: 'gwei',
                  value: 2.1,
                },
              }),
            } as unknown as Response)
          })

          it('should throw an error', async () => {
            await expect(
              checkGasPrice(components, transactionData)
            ).rejects.toThrow()
          })
        })

        describe('and the current network gas price could not be fetched', () => {
          beforeEach(() => {
            const { fetcher } = components
            jest.spyOn(fetcher, 'fetch').mockResolvedValueOnce({
              ok: false,
            } as unknown as Response)
          })

          it('should throw an error', async () => {
            await expect(
              checkGasPrice(components, transactionData)
            ).rejects.toThrow()
          })
        })
      })

      describe('and the max gas price allowed is not defined', () => {
        it('should throw an error', async () => {
          await expect(
            checkGasPrice(components, transactionData)
          ).rejects.toThrow()
        })
      })

      describe('and the txn contract method is allowed to skip max gas price', () => {
        describe('and the txn approve the collection manager to spend mana on behalf of the user', () => {
          it('should not throw an error', async () => {
            transactionData = {
              from: '0xe539E0AED3C1971560517D58277f8dd9aC296281',
              params: [
                '0x882Da5967c435eA5cC6b09150d55E8304B838f45',
                '0x0c53c51c000000000000000000000000f7b0e5d753747f102369cc6f8f33cc3feacf7c6200000000000000000000000000000000000000000000000000000000000000a072551c70696250b6de0ec4f3255f3a9e804b06080e2e65e34ac03ea6bddf6df910b461441d1a4ac26f3848e2d65635315891e0d4b4745e02123038616be2a362000000000000000000000000000000000000000000000000000000000000001b0000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000e539e0aed3c1971560517d58277f8dd9ac296281ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000',
              ],
            }
            await expect(
              checkGasPrice(components, transactionData)
            ).resolves.not.toThrow()
          })
        })

        describe('and the txn allow the collection manager to create collections using the CollectionFactoryV3', () => {
          it('should not throw an error', async () => {
            transactionData = {
              from: '0x2a39d4f68133491f0442496f601cde2a945b6d31',
              params: [
                '0xe539E0AED3C1971560517D58277f8dd9aC296281',
                '0x0c53c51c0000000000000000000000002a39d4f68133491f0442496f601cde2a945b6d3100000000000000000000000000000000000000000000000000000000000000a02cdc558d4b27b0a59f67fb3d9063e4c0a14544862d374b211ef879551b98e26e51331eecf7fd46afd5fa9ed902892afe531c87b85a1de020e44ec0cd9db11b4e000000000000000000000000000000000000000000000000000000000000001c00000000000000000000000000000000000000000000000000000000000009a435a629c200000000000000000000000071e56ad57eca3faae5077b7f9ea731a25785ff92000000000000000000000000ddb3781fff645325c8896aa1f067baa381607eccc791465139c2264063eb48cebbef411c046a347e711cbe5701ee2d55c488fd3f0000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001800000000000000000000000002a39d4f68133491f0442496f601cde2a945b6d3100000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000012466f7254657374696e67507572706f7365730000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001044434c2d46525453544e47505250535300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004368747470733a2f2f706565722e646563656e7472616c616e642e7a6f6e652f6c616d626461732f636f6c6c656374696f6e732f7374616e646172642f6572633732312f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000001e0000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000540000000000000000000000000000000000000000000000000000000000000066000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000006756e6971756500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000026313a773a417572613a3a746f705f686561643a426173654d616c652c4261736546656d616c65000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000006636f6d6d6f6e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b313a773a4e65772073746172743a3a746f705f686561643a426173654d616c652c4261736546656d616c6500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000006636f6d6d6f6e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002b313a773a4e65772073746172323a3a746f705f686561643a426173654d616c652c4261736546656d616c6500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000006756e697175650000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a313a773a556e7469746c65643a3a746f705f686561643a426173654d616c652c4261736546656d616c650000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000006636f6d6d6f6e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a313a773a41726d61747572653a3a746f705f686561643a426173654d616c652c4261736546656d616c650000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000006636f6d6d6f6e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002c313a773a41726d617475726532323a3a746f705f686561643a426173654d616c652c4261736546656d616c65000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
              ],
            }
            await expect(
              checkGasPrice(components, transactionData)
            ).resolves.not.toThrow()
          })
        })

        describe('and the txn allow/disallow the collection store to mint items', () => {
          beforeEach(() => {
            contractsMock.mockReset()
            contractsMock.mockResolvedValueOnce(true)
          })

          it('should not throw an error', async () => {
            transactionData = {
              from: '0xe539E0AED3C1971560517D58277f8dd9aC296281',
              params: [
                '0xcb7a75479cdc3c10cee1ab4ca15da7036d272b95',
                '0x0c53c51c0000000000000000000000002a39d4f68133491f0442496f601cde2a945b6d3100000000000000000000000000000000000000000000000000000000000000a0059b645263896e751301a367e27e4fdb28189761781363ccdfe83cdb330f2c2672b153a5572a3d1a8e8698cdb1a1a838eff73f5dec4d24908d607067bdf631da000000000000000000000000000000000000000000000000000000000000001b00000000000000000000000000000000000000000000000000000000000000c441bceced0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006ddf1b1924dad850adbc1c02026535464be06b0c0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000',
              ],
            }
            await expect(
              checkGasPrice(components, transactionData)
            ).resolves.not.toThrow()
          })
        })
      })
    })

    describe('and the FF MAX_GAS_PRICE_ALLOWED_IN_WEI is turned off', () => {
      beforeEach(() => {
        const { features } = components
        jest.spyOn(features, 'getIsFeatureEnabled').mockResolvedValueOnce(false)
      })

      it('should not throw an error', async () => {
        await expect(
          checkGasPrice(components, transactionData)
        ).resolves.not.toThrow()
      })
    })
  })
})
