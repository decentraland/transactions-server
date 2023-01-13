import path from 'path'
import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  createStatusCheckComponent,
} from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@well-known-components/metrics'
import { createSubgraphComponent } from '@well-known-components/thegraph-component'
import { createPgComponent } from '@well-known-components/pg-component'
import { createContractsComponent } from './ports/contracts/component'
import { createFetchComponent } from './ports/fetcher'
import { createTransactionComponent } from './ports/transaction/component'
import { metricDeclarations } from './metrics'
import { AppComponents, GlobalContext } from './types'

export async function initComponents(): Promise<AppComponents> {
  // default config from process.env + .env file
  const config = await createDotEnvConfigComponent(
    { path: ['.env.defaults', '.env'] },
    process.env
  )

  const cors = {
    origin: await config.getString('CORS_ORIGIN'),
    method: await config.getString('CORS_METHOD'),
  }

  const logs = createLogComponent()
  const server = await createServerComponent<GlobalContext>(
    { config, logs },
    { cors, compression: {} }
  )
  const statusChecks = await createStatusCheckComponent({ config, server })
  const fetcher = await createFetchComponent()
  const metrics = await createMetricsComponent(metricDeclarations, {
    server,
    config,
  })

  let databaseUrl: string | undefined = await config.getString(
    'PG_COMPONENT_PSQL_CONNECTION_STRING'
  )

  if (!databaseUrl) {
    const dbUser = await config.requireString('PG_COMPONENT_PSQL_USER')
    const dbDatabaseName = await config.requireString(
      'PG_COMPONENT_PSQL_DATABASE'
    )
    const dbPort = await config.requireString('PG_COMPONENT_PSQL_PORT')
    const dbHost = await config.requireString('PG_COMPONENT_PSQL_HOST')
    const dbPassword = await config.requireString('PG_COMPONENT_PSQL_PASSWORD')
    databaseUrl = `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbDatabaseName}`
  }

  const pg = await createPgComponent(
    { logs, config, metrics },
    {
      migration: {
        databaseUrl,
        dir: path.resolve(__dirname, 'migrations'),
        migrationsTable: 'pgmigrations',
        ignorePattern: '.*\\.map',
        direction: 'up',
      },
    }
  )
  const collectionsSubgraph = await createSubgraphComponent(
    { config, logs, fetch: fetcher, metrics },
    await config.requireString('COLLECTIONS_SUBGRAPH_URL')
  )
  const contracts = createContractsComponent({
    config,
    fetcher,
    collectionsSubgraph,
  })
  const transaction = createTransactionComponent({
    config,
    fetcher,
    pg,
    contracts,
    metrics,
  })
  const globalLogger = logs.getLogger('transactions-server')

  return {
    config,
    logs,
    globalLogger,
    fetcher,
    metrics,
    server,
    pg,
    transaction,
    contracts,
    collectionsSubgraph,
    statusChecks,
  }
}
