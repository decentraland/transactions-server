import { Response } from 'node-fetch'
import { checkGasPrice } from '../../../../src/ports/transaction/validation/checkGasPrice'
import { test } from '../../../components'
import { TransactionData } from '../../../../src/ports/transaction/types'

test('checkGasPrice component', function ({ components }) {
  const from = '0x9Ab8A53AA9695dAb57e62684aBA6978E5225ED0b'
  let transactionData: TransactionData

  beforeEach(() => {
    const { contracts } = components

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
      beforeEach(() => {
        const { contracts, features } = components
        jest.spyOn(features, 'getIsFeatureEnabled').mockResolvedValueOnce(true)
        jest
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
