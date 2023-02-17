import { Response } from 'node-fetch'
import { test } from '../../components'

test('features component', function ({ components }) {
  const FF_APP = 'TestApp'
  const FF_TOGGLE = 'TestFF'
  const FF_KEY = `${FF_APP}-${FF_TOGGLE}`

  describe('when checking a feature flag is enabled', () => {
    describe('and the feature flag is in the .env file', () => {
      describe('and the feature flag is enabled', () => {
        beforeEach(() => {
          const { config } = components
          jest.spyOn(config, 'getString').mockResolvedValueOnce('1')
        })

        it('should return true', () => {
          const { features } = components
          return expect(
            features.getIsFeatureEnabled(FF_APP, FF_TOGGLE)
          ).resolves.toBe(true)
        })
      })

      describe('and the feature flag is disabled', () => {
        beforeEach(() => {
          const { config } = components
          jest.spyOn(config, 'getString').mockResolvedValueOnce('0')
        })

        it('should return false', () => {
          const { features } = components
          return expect(
            features.getIsFeatureEnabled(FF_APP, FF_TOGGLE)
          ).resolves.toBe(false)
        })
      })
    })

    describe('and the feature flag is not in the .env file', () => {
      beforeEach(() => {
        const { features } = components
        jest.spyOn(features, 'getEnvFeature').mockResolvedValueOnce(undefined)
      })

      describe('and the feature flag is fetched successfully from the features service', () => {
        describe('and the feature flag is enabled', () => {
          beforeAll(() => {
            const { fetcher } = components
            jest.spyOn(fetcher, 'fetch').mockResolvedValueOnce({
              ok: true,
              json: jest.fn().mockResolvedValueOnce({
                flags: { [FF_KEY]: true },
              }),
            } as unknown as Response)
          })

          it('should return true', () => {
            const { features } = components
            return expect(
              features.getIsFeatureEnabled(FF_APP, FF_TOGGLE)
            ).resolves.toBe(true)
          })
        })

        describe('and the feature flag is disabled', () => {
          beforeAll(() => {
            const { fetcher } = components
            jest.spyOn(fetcher, 'fetch').mockResolvedValueOnce({
              ok: true,
              json: jest.fn().mockResolvedValueOnce({
                flags: {},
              }),
            } as unknown as Response)
          })

          it('should return false', () => {
            const { features } = components
            return expect(
              features.getIsFeatureEnabled(FF_APP, FF_TOGGLE)
            ).resolves.toBe(false)
          })
        })
      })

      describe('and the feature flag could not be fetched successfully from features service', () => {
        beforeAll(() => {
          const { fetcher } = components
          jest.spyOn(fetcher, 'fetch').mockResolvedValueOnce({
            ok: false,
          } as unknown as Response)
        })

        it('should return false', () => {
          const { features } = components
          return expect(
            features.getIsFeatureEnabled(FF_APP, FF_TOGGLE)
          ).resolves.toBe(false)
        })
      })
    })
  })

  describe('when checking a feature flag variant', () => {
    describe('and the feature flag is enabled', () => {
      describe('and the feature flag has a variant', () => {
        const FF_VARIANT = {
          name: 'TestFFVariant',
          payload: {
            type: 'string',
            value: '1',
          },
          enabled: true,
        }

        beforeAll(() => {
          const { fetcher } = components
          jest.spyOn(fetcher, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValueOnce({
              flags: {
                [FF_KEY]: true,
              },
              variants: { [FF_KEY]: FF_VARIANT },
            }),
          } as unknown as Response)
        })

        it('should return the variant data', () => {
          const { features } = components
          return expect(
            features.getFeatureVariant(FF_APP, FF_TOGGLE)
          ).resolves.toBe(FF_VARIANT)
        })
      })

      describe('and the feature flag does not have a variant', () => {
        beforeAll(() => {
          const { fetcher } = components
          jest.spyOn(fetcher, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: jest.fn().mockResolvedValueOnce({
              flags: {
                [FF_KEY]: true,
              },
              variants: {},
            }),
          } as unknown as Response)
        })

        it('should return null', () => {
          const { features } = components
          return expect(
            features.getFeatureVariant(FF_APP, FF_TOGGLE)
          ).resolves.toBe(null)
        })
      })
    })

    describe('and the feature flag is disabled', () => {
      beforeAll(() => {
        const { fetcher } = components
        jest.spyOn(fetcher, 'fetch').mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            flags: {},
          }),
        } as unknown as Response)
      })

      it('should return null', () => {
        const { features } = components
        return expect(
          features.getFeatureVariant(FF_APP, FF_TOGGLE)
        ).resolves.toBe(null)
      })
    })
  })
})
