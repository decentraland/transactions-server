import { Response } from 'node-fetch'
import { checkGasPrice } from '../../../../src/ports/transaction/validation/checkGasPrice'
import { test } from '../../../components'
import { TransactionData } from '../../../../src/ports/transaction/types'
import TransactionDataMock from '../../../mocks/transactionData'

test('checkGasPrice component', function ({ components }) {
  let transactionData: TransactionData

  describe('when checking the gas price for a txn', () => {
    describe('and the FF MAX_GAS_PRICE_ALLOWED_IN_WEI is turned on', () => {
      let contractsMock: jest.SpyInstance

      beforeEach(() => {
        const { contracts, features } = components
        transactionData = { ...TransactionDataMock.setManager }
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
        beforeEach(() => {
          const { features, fetcher } = components
          jest.spyOn(features, 'getFeatureVariant').mockResolvedValueOnce({
            name: 'max-gas-price-allowed-in-wei',
            payload: {
              type: 'string',
              value: '2000000000',
            },
            enabled: true,
          })
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
        describe('and the txn is an approve of the collection manager to spend mana on behalf of the user', () => {
          it('should not throw an error', async () => {
            await expect(
              checkGasPrice(components, TransactionDataMock.approveMana)
            ).resolves.not.toThrow()
          })
        })

        describe('and the txn is an allowance of the collection manager to create collections using the CollectionFactoryV3', () => {
          it('should not throw an error', async () => {
            await expect(
              checkGasPrice(components, TransactionDataMock.createCollection)
            ).resolves.not.toThrow()
          })
        })

        describe('and the txn allow/disallow the collection store to mint items', () => {
          beforeEach(() => {
            contractsMock.mockReset()
            contractsMock.mockResolvedValueOnce(true)
          })

          it('should not throw an error', async () => {
            await expect(
              checkGasPrice(components, TransactionDataMock.setMinters)
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
