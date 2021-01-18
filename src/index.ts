import { config as configDotEnvFile } from 'dotenv'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  createStatusCheckComponent,
} from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { Lifecycle } from '@well-known-components/interfaces'
import { setupRoutes } from './adapters/routes'
import { createDatabaseComponent } from './ports/database/component'
import { createTransactionComponent } from './ports/transaction/component'
import { AppComponents, AppConfig, GlobalContext } from './types'

async function main(components: AppComponents) {
  const globalContext: GlobalContext = {
    components,
  }

  await setupRoutes(globalContext)
}

async function initComponents(): Promise<AppComponents> {
  configDotEnvFile()

  // default config
  const defaultValues: Partial<AppConfig> = {
    HTTP_SERVER_PORT: '5000',
    HTTP_SERVER_HOST: '0.0.0.0',
    API_VERSION: 'v1',
    BICONOMY_API_URL: 'https://api.biconomy.io/api/v2/meta-tx/native',
  }

  const config = createConfigComponent<AppConfig>(process.env, defaultValues)

  const cors = {
    origin: await config.getString('CORS_ORIGIN'),
    method: await config.getString('CORS_METHOD'),
  }

  const logs = createLogComponent()
  const server = await createServerComponent<GlobalContext>(
    { config, logs },
    { cors, compression: {} }
  )
  const database = await createDatabaseComponent({ logs })
  const transaction = await createTransactionComponent({
    config,
    logs,
    database,
  })
  const statusChecks = await createStatusCheckComponent({ server })

  return {
    config,
    logs,
    server,
    database,
    transaction,
    statusChecks,
  }
}

Lifecycle.programEntryPoint({
  main,
  initComponents,
}).catch((error) => console.error('Error staring app lifecycle', error))
