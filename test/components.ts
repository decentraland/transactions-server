import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  createStatusCheckComponent,
  IFetchComponent,
} from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@well-known-components/metrics'
import { metricDeclarations } from '../src/metrics'
import { createDatabaseComponent } from '../src/ports/database/component'
import {
  createFetchComponent,
  createTestFetchComponent,
} from '../src/ports/fetcher'
import { AppComponents, GlobalContext, TestComponents } from '../src/types'
import { main } from '../src/service'
import { createRunner } from '@well-known-components/test-helpers'
import { RequestInfo, RequestInit } from 'node-fetch'

// start TCP port for listeners
let lastUsedPort = 19000 + parseInt(process.env.JEST_WORKER_ID || '1') * 1000
function getFreePort() {
  return lastUsedPort + 1
}

/**
 * Behaves like Jest "describe" function, used to describe a test for a
 * use case, it creates a whole new program and components to run an
 * isolated test.
 *
 * State is persistent within the steps of the test.
 */
export const test = createRunner<TestComponents>({
  main,
  initComponents,
})

export async function initComponents(): Promise<TestComponents> {
  const currentPort = getFreePort()
  process.env.HTTP_SERVER_PORT = (currentPort + 1).toString()

  // default config from process.env + .env file
  const config = await createDotEnvConfigComponent(
    { path: ['.env.defaults', '.env'] },
    process.env
  )

  const protocolHostAndProtocol = `http://${await config.requireString(
    'HTTP_SERVER_HOST'
  )}:${await config.requireNumber('HTTP_SERVER_PORT')}`

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
  const fetcher = await createTestFetchComponent({
    localhost: protocolHostAndProtocol,
  })
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
