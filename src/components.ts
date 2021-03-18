import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  createStatusCheckComponent,
} from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from './metrics'
import { createDatabaseComponent } from './ports/database/component'
import { createFetchComponent } from './ports/fetcher'
import { AppComponents, AppConfig, GlobalContext } from './types'

export async function initComponents(): Promise<AppComponents> {
  // default config
  const defaultValues: Partial<AppConfig> = {
    HTTP_SERVER_PORT: '5000',
    HTTP_SERVER_HOST: '0.0.0.0',
    API_VERSION: 'v1',
    BICONOMY_API_URL: 'https://api.biconomy.io/api/v2/meta-tx/native',
  }

  const config = await createDotEnvConfigComponent({}, defaultValues)

  const cors = {
    origin: await config.getString('CORS_ORIGIN'),
    method: await config.getString('CORS_METHOD'),
  }

  const logs = createLogComponent()
  const server = await createServerComponent<GlobalContext>(
    { config, logs },
    { cors, compression: {} }
  )
  const database = await createDatabaseComponent(
    { logs },
    { filename: 'database.db' }
  )
  const statusChecks = await createStatusCheckComponent({ server })
  const fetcher = await createFetchComponent()
  const metrics = await createMetricsComponent(metricDeclarations, {
    server,
    config,
  })

  const globalLogger = logs.getLogger('transactions-server')

  return {
    config,
    logs,
    globalLogger,
    fetcher,
    metrics,
    server,
    database,
    statusChecks,
  }
}
