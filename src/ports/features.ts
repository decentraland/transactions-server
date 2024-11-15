import { IFetchComponent } from '@well-known-components/http-server'
import {
  IConfigComponent,
  ILoggerComponent,
} from '@well-known-components/interfaces'

// Note:
// features component may be encapsulated in @well-known-components/features
// in a future. for the time being, given it's simplicity and ease of configuration
// it can be implemented as follow to enable customizations:

export async function createFeaturesComponent(
  components: NeededComponents,
  referer: string
): Promise<IFeaturesComponent> {
  const { config, fetch, logs } = components
  const FF_URL =
    (await config.getString('FF_URL')) ??
    'https://feature-flags.decentraland.org'

  const logger = logs.getLogger('transactions-server')

  async function getEnvFeature(
    app: string,
    feature: string
  ): Promise<string | undefined> {
    return config.getString(`FF_${app}_${feature}`.toUpperCase())
  }

  async function fetchFeatureFlags(
    app: string
  ): Promise<FeaturesFlagsResponse | null> {
    try {
      const response = await fetch.fetch(`${FF_URL}/${app}.json`, {
        headers: {
          Referer: referer,
        },
      })

      if (response.ok) {
        return await response.json()
      } else {
        throw new Error(`Could not fetch features service from ${FF_URL}`)
      }
    } catch (error) {
      logger.error(error as Error)
    }

    return null
  }

  async function getIsFeatureEnabled(
    app: string,
    feature: string
  ): Promise<boolean> {
    const envFeatureFlag = await getEnvFeature(app, feature)

    if (envFeatureFlag) {
      return envFeatureFlag === '1' ? true : false
    }

    const featureFlags = await fetchFeatureFlags(app)

    return !!featureFlags?.flags[`${app}-${feature}`]
  }

  async function getFeatureVariant<FeatureFlagVariant>(
    app: string,
    feature: string
  ): Promise<FeatureFlagVariant | null> {
    const ffKey = `${app}-${feature}`
    const featureFlags = await fetchFeatureFlags(app)

    if (featureFlags?.flags[ffKey] && featureFlags?.variants[ffKey]) {
      return featureFlags.variants[ffKey] as unknown as FeatureFlagVariant
    }

    return null
  }

  return {
    getEnvFeature,
    getIsFeatureEnabled,
    getFeatureVariant,
  }
}

export type IFeaturesComponent = {
  /**
   * Helper to get whether a feature flag is enabled or disabled.
   * It will first look into your env file for the feature flag, if it is not defined there,
   * it will look it in the requested and stored features data.
   * The env key will be determined from the application and the flag. For example, if the
   * application is "explorer" and the flag is "some-crazy-feature", it will look
   * for it as FF_EXPLORER_SOME_CRAZY_FEATURE.
   * @param app Appplication name.
   * @param feature Feature key without the application name prefix. For example for the "builder-feature".
   * @returns Whether the feature is enabled or not and its variant.
   */
  getEnvFeature(app: string, feature: string): Promise<string | undefined>
  getIsFeatureEnabled(app: string, feature: string): Promise<boolean>
  getFeatureVariant(
    app: string,
    feature: string
  ): Promise<FeatureFlagVariant | null>
}

export type FeaturesFlagsResponse = {
  flags: Record<string, boolean>
  variants: Record<string, FeatureFlagVariant>
}

export type FeatureFlagVariant = {
  name: string
  payload: {
    type: string
    value: string
  }
  enabled: boolean
}

export type NeededComponents = {
  config: IConfigComponent
  fetch: IFetchComponent
  logs: ILoggerComponent
}

export enum Feature {
  GELATO_RELAYER = 'gelato-relayer',
}

export enum ApplicationName {
  EXPLORER = 'explorer',
  BUILDER = 'builder',
  MARKETPLACE = 'marketplace',
  ACCOUNT = 'account',
  DAO = 'dao',
  DAPPS = 'dapps',
  EVENTS = 'events',
  LANDING = 'landing',
  TEST = 'test',
}
