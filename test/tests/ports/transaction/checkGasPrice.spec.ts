import { Response } from 'node-fetch'
import { checkGasPrice } from '../../../../src/ports/transaction/validation/checkGasPrice'
import { test } from '../../../components'

test('checkGasPrice component', function ({ components }) {
  describe('when checking the gas price for a txn', () => {
    describe('and the FF MAX_GAS_PRICE_ALLOWED_IN_WEI is turned on', () => {
      beforeEach(() => {
        const { features } = components
        jest.spyOn(features, 'getIsFeatureEnabled').mockResolvedValueOnce(true)
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
            await expect(checkGasPrice(components)).resolves.not.toThrow()
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
            await expect(checkGasPrice(components)).rejects.toThrow()
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
            await expect(checkGasPrice(components)).rejects.toThrow()
          })
        })
      })

      describe('and the max gas price allowed is not defined', () => {
        it('should throw an error', async () => {
          await expect(checkGasPrice(components)).rejects.toThrow()
        })
      })
    })

    describe('and the FF MAX_GAS_PRICE_ALLOWED_IN_WEI is turned off', () => {
      beforeEach(() => {
        const { features } = components
        jest.spyOn(features, 'getIsFeatureEnabled').mockResolvedValueOnce(false)
      })

      it('should not throw an error', async () => {
        await expect(checkGasPrice(components)).resolves.not.toThrow()
      })
    })
  })
})
