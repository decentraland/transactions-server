import { IConfigComponent } from '@well-known-components/interfaces'
import { IFeaturesComponent } from '@well-known-components/features-component/dist/types'
import { BigNumber } from 'ethers'
import { BiconomyMetaTransactionComponent } from '../../../../src/ports/biconomy'
import { IContractsComponent } from '../../../../src/ports/contracts/types'
import { GelatoMetaTransactionComponent } from '../../../../src/ports/gelato'
import { checkGasPrice } from '../../../../src/ports/transaction/validation/checkGasPrice'
import { TransactionData } from '../../../../src/types/transactions'
import TransactionDataMock from '../../../mocks/transactionData'

let transactionData: TransactionData
let config: IConfigComponent
let contracts: IContractsComponent
let features: IFeaturesComponent
let gelato: GelatoMetaTransactionComponent
let biconomy: BiconomyMetaTransactionComponent
let gelatoGetNetworkGasPriceMock: jest.Mock
let biconomyGetNetworkGasPriceMock: jest.Mock
let getIsFeatureEnabledMock: jest.Mock
let getFeatureVariantMock: jest.Mock
let isCollectionAddressMock: jest.Mock
let components: {
  config: IConfigComponent
  contracts: IContractsComponent
  features: IFeaturesComponent
  gelato: GelatoMetaTransactionComponent
  biconomy: BiconomyMetaTransactionComponent
}

beforeEach(() => {
  isCollectionAddressMock = jest.fn()
  getIsFeatureEnabledMock = jest.fn()
  getFeatureVariantMock = jest.fn()
  gelatoGetNetworkGasPriceMock = jest.fn()
  biconomyGetNetworkGasPriceMock = jest.fn()
  config = {
    requireString: async () => 'Sepolia',
    requireNumber: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
  }
  contracts = {
    isCollectionAddress: isCollectionAddressMock,
    isValidAddress: jest.fn(),
    isWhitelisted: jest.fn(),
    getCollectionQuery: jest.fn(),
    clearCache: jest.fn(),
  }
  features = {
    getIsFeatureEnabled: getIsFeatureEnabledMock,
    getFeatureVariant: getFeatureVariantMock,
    getEnvFeature: jest.fn(),
  }
  gelato = {
    sendMetaTransaction: jest.fn(),
    getNetworkGasPrice: gelatoGetNetworkGasPriceMock,
  }
  biconomy = {
    sendMetaTransaction: jest.fn(),
    getNetworkGasPrice: biconomyGetNetworkGasPriceMock,
  }

  components = {
    config,
    contracts,
    features,
    gelato,
    biconomy,
  }
})

describe('when checking the gas price for a txn', () => {
  describe('and the FF MAX_GAS_PRICE_ALLOWED_IN_WEI is turned on', () => {
    beforeEach(() => {
      isCollectionAddressMock.mockResolvedValueOnce(false)
      getIsFeatureEnabledMock.mockResolvedValueOnce(true)
      transactionData = { ...TransactionDataMock.setManager }
    })

    describe('and the max gas price allowed is defined', () => {
      beforeEach(() => {
        getFeatureVariantMock.mockResolvedValueOnce({
          name: 'max-gas-price-allowed-in-wei',
          payload: {
            type: 'string',
            value: '2000000000',
          },
          enabled: true,
        })
      })

      describe('and the is gelato enabled feature flag is set', () => {
        beforeEach(() => {
          getIsFeatureEnabledMock.mockResolvedValueOnce(true)
        })

        describe('and the current network gas price is lower than max gas price allowed', () => {
          beforeEach(() => {
            gelatoGetNetworkGasPriceMock.mockResolvedValueOnce(
              BigNumber.from(1000000000)
            )
          })

          it('should not throw an error', async () => {
            await expect(
              checkGasPrice(components, transactionData)
            ).resolves.not.toThrow()
          })
        })

        describe('and the current network gas price is greater than max gas price allowed', () => {
          beforeEach(() => {
            beforeEach(() => {
              gelatoGetNetworkGasPriceMock.mockResolvedValueOnce(
                BigNumber.from(2100000000)
              )
            })
          })

          it('should throw an error', async () => {
            await expect(
              checkGasPrice(components, transactionData)
            ).rejects.toThrow()
          })
        })

        describe('and the current network gas price could not be fetched', () => {
          beforeEach(() => {
            const { gelato } = components
            gelatoGetNetworkGasPriceMock.mockRejectedValueOnce(new Error())
          })

          it('should throw an error', async () => {
            await expect(
              checkGasPrice(components, transactionData)
            ).rejects.toThrow()
          })
        })
      })

      describe('and the gelato enabled feature is not set', () => {
        beforeEach(() => {
          getIsFeatureEnabledMock.mockResolvedValueOnce(false)
        })

        describe('and the current network gas price is lower than max gas price allowed', () => {
          beforeEach(() => {
            biconomyGetNetworkGasPriceMock.mockResolvedValueOnce(
              BigNumber.from(1000000000)
            )
          })

          it('should not throw an error', async () => {
            await expect(
              checkGasPrice(components, transactionData)
            ).resolves.not.toThrow()
          })
        })

        describe('and the current network gas price is greater than max gas price allowed', () => {
          beforeEach(() => {
            beforeEach(() => {
              biconomyGetNetworkGasPriceMock.mockResolvedValueOnce(
                BigNumber.from(2100000000)
              )
            })
          })

          it('should throw an error', async () => {
            await expect(
              checkGasPrice(components, transactionData)
            ).rejects.toThrow()
          })
        })

        describe('and the current network gas price could not be fetched', () => {
          beforeEach(() => {
            biconomyGetNetworkGasPriceMock.mockRejectedValueOnce(new Error())
          })

          it('should throw an error', async () => {
            await expect(
              checkGasPrice(components, transactionData)
            ).rejects.toThrow()
          })
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
        getIsFeatureEnabledMock.mockResolvedValueOnce(true)
        getFeatureVariantMock.mockResolvedValueOnce({
          name: 'max-gas-price-allowed',
          payload: {
            type: 'string',
            value: '2000000000',
          },
          enabled: true,
        })
        gelatoGetNetworkGasPriceMock.mockResolvedValueOnce(
          BigNumber.from(2100000000)
        )
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
          isCollectionAddressMock.mockReset().mockResolvedValueOnce(true)
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
      getIsFeatureEnabledMock.mockResolvedValueOnce(false)
    })

    it('should not throw an error', async () => {
      await expect(
        checkGasPrice(components, transactionData)
      ).resolves.not.toThrow()
    })
  })
})
