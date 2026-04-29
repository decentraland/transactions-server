import { ILoggerComponent } from '@well-known-components/interfaces'
import { IFeaturesComponent } from '@well-known-components/features-component/dist/types'
import { ApplicationName } from '@well-known-components/features-component'
import { Feature } from '../../../../src/ports/features'
import { createRelayRouterComponent } from '../../../../src/ports/relay-router'
import { IRelayRouterComponent } from '../../../../src/ports/relay-router/types'
import {
  IMetaTransactionProviderComponent,
  TransactionData,
} from '../../../../src/types/transactions/transactions'
import { createCollection } from '../../../mocks/transactionData'

let logs: ILoggerComponent
let features: IFeaturesComponent
let gelato: IMetaTransactionProviderComponent
let openzeppelin: IMetaTransactionProviderComponent
let transactionData: TransactionData
let getFeatureVariantMock: jest.Mock
let gelatoSendMock: jest.Mock
let ozSendMock: jest.Mock

beforeEach(() => {
  transactionData = createCollection
  getFeatureVariantMock = jest.fn()
  gelatoSendMock = jest.fn()
  ozSendMock = jest.fn()
  logs = {
    getLogger: () => ({
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
    }),
  } as ILoggerComponent
  features = {
    getIsFeatureEnabled: jest.fn(),
    getFeatureVariant: getFeatureVariantMock,
    getEnvFeature: jest.fn(),
  }
  gelato = {
    sendMetaTransaction: gelatoSendMock,
    getNetworkGasPrice: jest.fn(),
  }
  openzeppelin = {
    sendMetaTransaction: ozSendMock,
    getNetworkGasPrice: jest.fn(),
  }
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('when creating the relay router', () => {
  describe('and no providers are configured', () => {
    it('should throw naming the env vars that enable each relayer', () => {
      expect(() => createRelayRouterComponent({ logs, features })).toThrow(
        'relay-router: no providers configured; set GELATO_API_KEY or OZ_RELAYER_URL to enable at least one relayer'
      )
    })
  })
})

describe('when only gelato is configured', () => {
  let router: IRelayRouterComponent

  beforeEach(() => {
    router = createRelayRouterComponent({ logs, features, gelato })
  })

  describe('and sending a meta transaction', () => {
    beforeEach(() => {
      gelatoSendMock.mockResolvedValueOnce('gelato-tx-hash')
    })

    it('should delegate to gelato and return its transaction hash', async () => {
      await expect(router.sendMetaTransaction(transactionData)).resolves.toBe(
        'gelato-tx-hash'
      )
      expect(gelatoSendMock).toHaveBeenCalledWith(transactionData)
    })
  })
})

describe('when only openzeppelin is configured', () => {
  let router: IRelayRouterComponent

  beforeEach(() => {
    router = createRelayRouterComponent({ logs, features, openzeppelin })
  })

  describe('and sending a meta transaction', () => {
    beforeEach(() => {
      ozSendMock.mockResolvedValueOnce('oz-tx-hash')
    })

    it('should delegate to openzeppelin and return its transaction hash', async () => {
      await expect(router.sendMetaTransaction(transactionData)).resolves.toBe(
        'oz-tx-hash'
      )
      expect(ozSendMock).toHaveBeenCalledWith(transactionData)
    })
  })
})

describe('when both providers are configured', () => {
  let router: IRelayRouterComponent

  beforeEach(() => {
    router = createRelayRouterComponent({
      logs,
      features,
      gelato,
      openzeppelin,
    })
  })

  describe('and the feature flag variant selects gelato', () => {
    beforeEach(() => {
      getFeatureVariantMock.mockResolvedValueOnce({
        name: Feature.RELAY_PROVIDER,
        payload: { value: 'gelato' },
      })
      gelatoSendMock.mockResolvedValueOnce('gelato-tx-hash')
    })

    it('should look up the feature flag under the dapps application', async () => {
      await router.sendMetaTransaction(transactionData)
      expect(getFeatureVariantMock).toHaveBeenCalledWith(
        ApplicationName.DAPPS,
        Feature.RELAY_PROVIDER
      )
    })

    it('should delegate to gelato and leave openzeppelin untouched', async () => {
      await expect(router.sendMetaTransaction(transactionData)).resolves.toBe(
        'gelato-tx-hash'
      )
      expect(gelatoSendMock).toHaveBeenCalledWith(transactionData)
      expect(ozSendMock).not.toHaveBeenCalled()
    })
  })

  describe('and the feature flag variant selects openzeppelin', () => {
    beforeEach(() => {
      getFeatureVariantMock.mockResolvedValueOnce({
        name: Feature.RELAY_PROVIDER,
        payload: { value: 'openzeppelin' },
      })
      ozSendMock.mockResolvedValueOnce('oz-tx-hash')
    })

    it('should delegate to openzeppelin and leave gelato untouched', async () => {
      await expect(router.sendMetaTransaction(transactionData)).resolves.toBe(
        'oz-tx-hash'
      )
      expect(ozSendMock).toHaveBeenCalledWith(transactionData)
      expect(gelatoSendMock).not.toHaveBeenCalled()
    })
  })

  describe('and the feature flag variant is "random"', () => {
    beforeEach(() => {
      getFeatureVariantMock.mockResolvedValueOnce({
        name: Feature.RELAY_PROVIDER,
        payload: { value: 'random' },
      })
      // Math.floor(0 * 2) === 0 -> picks the first available (gelato)
      jest.spyOn(Math, 'random').mockReturnValue(0)
      gelatoSendMock.mockResolvedValueOnce('gelato-tx-hash')
    })

    it('should pick a provider at random without honoring a specific name', async () => {
      await expect(router.sendMetaTransaction(transactionData)).resolves.toBe(
        'gelato-tx-hash'
      )
      expect(gelatoSendMock).toHaveBeenCalledWith(transactionData)
    })
  })

  describe('and the feature flag asks for a provider that is not configured', () => {
    beforeEach(() => {
      getFeatureVariantMock.mockResolvedValueOnce({
        name: Feature.RELAY_PROVIDER,
        payload: { value: 'nonexistent' },
      })
      jest.spyOn(Math, 'random').mockReturnValue(0)
      gelatoSendMock.mockResolvedValueOnce('gelato-tx-hash')
    })

    it('should fall back to a random configured provider instead of throwing', async () => {
      await expect(router.sendMetaTransaction(transactionData)).resolves.toBe(
        'gelato-tx-hash'
      )
    })
  })

  describe('and the feature flag lookup throws', () => {
    beforeEach(() => {
      getFeatureVariantMock.mockRejectedValueOnce(
        new Error('feature flag service unavailable')
      )
      jest.spyOn(Math, 'random').mockReturnValue(0)
      gelatoSendMock.mockResolvedValueOnce('gelato-tx-hash')
    })

    it('should fall back to a random configured provider instead of propagating the error', async () => {
      await expect(router.sendMetaTransaction(transactionData)).resolves.toBe(
        'gelato-tx-hash'
      )
    })
  })

  describe('and a caller asks the router which provider would handle the next transaction', () => {
    describe('and the feature flag selects gelato', () => {
      beforeEach(() => {
        getFeatureVariantMock.mockResolvedValueOnce({
          name: Feature.RELAY_PROVIDER,
          payload: { value: 'gelato' },
        })
      })

      it('should resolve to the gelato provider', async () => {
        const resolved = await router.resolveProvider()
        expect(resolved.name).toBe('gelato')
        expect(resolved.provider).toBe(gelato)
      })
    })

    describe('and the feature flag selects openzeppelin', () => {
      beforeEach(() => {
        getFeatureVariantMock.mockResolvedValueOnce({
          name: Feature.RELAY_PROVIDER,
          payload: { value: 'openzeppelin' },
        })
      })

      it('should resolve to the openzeppelin provider', async () => {
        const resolved = await router.resolveProvider()
        expect(resolved.name).toBe('openzeppelin')
        expect(resolved.provider).toBe(openzeppelin)
      })
    })

    describe('and the feature flag is missing', () => {
      beforeEach(() => {
        getFeatureVariantMock.mockResolvedValueOnce(undefined)
        jest.spyOn(Math, 'random').mockReturnValue(0)
      })

      it('should resolve to one of the configured providers', async () => {
        const resolved = await router.resolveProvider()
        expect(['gelato', 'openzeppelin']).toContain(resolved.name)
      })
    })
  })
})
