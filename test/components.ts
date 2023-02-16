import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  createStatusCheckComponent,
} from '@well-known-components/http-server'
import { createSubgraphComponent } from '@well-known-components/thegraph-component'
import { createLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@well-known-components/metrics'
import { createPgComponent } from '@well-known-components/pg-component'
import { createRunner } from '@well-known-components/test-helpers'
import { metricDeclarations } from '../src/metrics'
import { createContractsComponent } from '../src/ports/contracts/component'
import { createTransactionComponent } from '../src/ports/transaction/component'
import { createTestFetchComponent } from '../src/ports/fetcher'
import { createFeaturesComponent } from '../src/ports/features'
import { GlobalContext, TestComponents } from '../src/types'
import { main } from '../src/service'

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
    { path: ['.env.spec'] },
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

  const fetcher = await createTestFetchComponent({
    localhost: protocolHostAndProtocol,
  })
  const features = await createFeaturesComponent(
    {
      config,
      logs,
      fetch: fetcher,
    },
    await config.requireString('TRANSACTIONS_SERVER_URL')
  )
  const metrics = await createMetricsComponent(metricDeclarations, {
    server,
    config,
  })
  const pg = await createPgComponent({ logs, config, metrics })
  const collectionsSubgraph = await createSubgraphComponent(
    { config, logs, fetch: fetcher, metrics },
    await config.requireString('COLLECTIONS_SUBGRAPH_URL')
  )
  const statusChecks = await createStatusCheckComponent({ config, server })
  const contracts = createContractsComponent({
    config,
    fetcher,
    collectionsSubgraph,
  })
  const transaction = createTransactionComponent({
    fetcher,
    features,
    logs,
    config,
    pg,
    metrics,
    contracts,
  })

  const globalLogger = logs.getLogger('transactions-server')

  // Mock the start function to avoid connecting to a local database
  jest.spyOn(pg, 'start').mockResolvedValue()

  return {
    config,
    logs,
    globalLogger,
    fetcher,
    features,
    metrics,
    server,
    transaction,
    pg,
    contracts,
    collectionsSubgraph,
    statusChecks,
  }
}
