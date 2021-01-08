import { config as configDotEnvFile } from 'dotenv'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  createStatusCheckComponent,
} from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { Lifecycle } from '@well-known-components/interfaces'
import { setupRoutes } from './adapters/routes'
import { setupLogs } from './adapters/logs'
import { AppComponents, AppConfig, GlobalContext } from './types'

async function main(components: AppComponents) {
  const globalContext: GlobalContext = {
    components,
  }

  setupLogs(components)
  await setupRoutes(globalContext)
}

async function initComponents(): Promise<AppComponents> {
  configDotEnvFile()

  // default config
  const defaultValues: Partial<AppConfig> = {
    HTTP_SERVER_PORT: '5000',
    HTTP_SERVER_HOST: '0.0.0.0',
    API_VERSION: 'v1',
  }

  const config = createConfigComponent<AppConfig>(process.env, defaultValues)
  const logs = createLogComponent()
  const server = await createServerComponent(
    { config, logs },
    { cors: {}, compression: {} }
  )
  const statusChecks = await createStatusCheckComponent({ server })

  return {
    config,
    server,
    logs,
    statusChecks,
  }
}

Lifecycle.programEntryPoint({
  main,
  initComponents,
}).catch((error) => console.error('Error staring app lifecycle', error))
