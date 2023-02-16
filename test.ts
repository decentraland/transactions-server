import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import { createLogComponent } from '@well-known-components/logger'

import { createFetchComponent } from './src/ports/fetcher'
import { createFeaturesComponent } from './src/ports/features'

import { checkGasPrice } from './src/ports/transaction/validation/checkGasPrice'

export async function init() {
  const config = await createDotEnvConfigComponent(
    { path: ['.env.defaults', '.env'] },
    process.env
  )
  const logs = createLogComponent()

  const fetcher = await createFetchComponent()
  const features = await createFeaturesComponent(
    {
      config,
      logs,
      fetch: fetcher,
    },
    await config.requireString('TRANSACTIONS_SERVER_URL')
  )

  const isGasPriceAllowedFFEnabled = await features.getIsFeatureEnabled(
    'builder',
    'gas-price'
  )

  console.log(isGasPriceAllowedFFEnabled)

  const featureFlagVariant = await features.getFeatureVariant(
    'builder',
    'gas-price'
  )
  console.log(featureFlagVariant)

  await checkGasPrice({ config, features, fetcher, logs })
}

init()
