import { Response } from 'node-fetch'
import { IFetchComponent } from '@well-known-components/http-server'
import { createFeaturesComponent } from '@well-known-components/features-component'
import {
  IConfigComponent,
  ILoggerComponent,
} from '@well-known-components/interfaces'
import { IFeaturesComponent } from '@well-known-components/features-component/dist/types'

const FF_APP = 'TestApp'
const FF_TOGGLE = 'TestFF'
const FF_KEY = `${FF_APP}-${FF_TOGGLE}`

let components: {
  fetch: IFetchComponent
  config: IConfigComponent
  logs: ILoggerComponent
}
let features: IFeaturesComponent
let getStringMock: jest.Mock
let fetchMock: jest.Mock

beforeEach(async () => {
  getStringMock = jest.fn()
  fetchMock = jest.fn()
  components = {
    fetch: {
      fetch: fetchMock,
    } as IFetchComponent,
    logs: {
      getLogger: () => ({
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
        debug: jest.fn(),
      }),
    } as ILoggerComponent,
    config: {
      getString: getStringMock,
      requireString: jest.fn(),
      getNumber: jest.fn(),
      requireNumber: jest.fn(),
    } as IConfigComponent,
  }
  getStringMock.mockResolvedValueOnce('https://feature-flags.decentraland.org')
  features = await createFeaturesComponent(components, 'test')
})

describe('when checking a feature flag is enabled', () => {
  describe('and the feature flag is in the .env file', () => {
    describe('and the feature flag is enabled', () => {
      beforeEach(() => {
        getStringMock.mockResolvedValueOnce('1')
      })

      it('should return true', () => {
        return expect(
          features.getIsFeatureEnabled(FF_APP, FF_TOGGLE)
        ).resolves.toBe(true)
      })
    })

    describe('and the feature flag is disabled', () => {
      beforeEach(() => {
        getStringMock.mockResolvedValueOnce('0')
      })

      it('should return false', () => {
        return expect(
          features.getIsFeatureEnabled(FF_APP, FF_TOGGLE)
        ).resolves.toBe(false)
      })
    })
  })

  describe('and the feature flag is not in the .env file', () => {
    beforeEach(() => {
      getStringMock.mockResolvedValueOnce(undefined)
    })

    describe('and the feature flag is fetched successfully from the features service', () => {
      let flags: Record<string, boolean>
      beforeEach(() => {
        flags = {}
        fetchMock.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            flags,
          }),
        } as unknown as Response)
      })

      describe('and the feature flag is enabled', () => {
        beforeEach(() => {
          flags[FF_KEY] = true
        })

        it('should return true', () => {
          return expect(
            features.getIsFeatureEnabled(FF_APP, FF_TOGGLE)
          ).resolves.toBe(true)
        })
      })

      describe('and the feature flag is disabled', () => {
        beforeEach(() => {
          delete flags[FF_KEY]
        })
        it('should return false', () => {
          return expect(
            features.getIsFeatureEnabled(FF_APP, FF_TOGGLE)
          ).resolves.toBe(false)
        })
      })
    })
  })
})

describe('and the feature flag could not be fetched successfully from features service', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
    } as unknown as Response)
  })

  it('should return false', () => {
    return expect(
      features.getIsFeatureEnabled(FF_APP, FF_TOGGLE)
    ).resolves.toBe(false)
  })
})

describe('when checking a feature flag variant', () => {
  let flags: Record<string, boolean>
  let variants: Record<string, any>

  beforeEach(() => {
    flags = {}
    variants = {}
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        flags,
        variants,
      }),
    } as unknown as Response)
  })

  describe('and the feature flag is enabled', () => {
    beforeEach(() => {
      flags[FF_KEY] = true
    })

    describe('and the feature flag has a variant', () => {
      beforeEach(() => {
        variants[FF_KEY] = {
          name: 'TestFFVariant',
          payload: {
            type: 'string',
            value: '1',
          },
          enabled: true,
        }

        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            flags: {
              [FF_KEY]: true,
            },
            variants: { [FF_KEY]: variants[FF_KEY] },
          }),
        } as unknown as Response)
      })

      it('should return the variant data', () => {
        return expect(
          features.getFeatureVariant(FF_APP, FF_TOGGLE)
        ).resolves.toBe(variants[FF_KEY])
      })
    })

    describe('and the feature flag does not have a variant', () => {
      beforeEach(() => {
        delete variants[FF_KEY]
      })

      it('should return null', () => {
        return expect(
          features.getFeatureVariant(FF_APP, FF_TOGGLE)
        ).resolves.toBe(null)
      })
    })
  })

  describe('and the feature flag is disabled', () => {
    beforeEach(() => {
      delete flags[FF_KEY]
    })

    it('should return null', () => {
      return expect(
        features.getFeatureVariant(FF_APP, FF_TOGGLE)
      ).resolves.toBe(null)
    })
  })
})
