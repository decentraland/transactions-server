import path from 'path'
import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  createStatusCheckComponent,
} from '@well-known-components/http-server'
import { createTracerComponent } from '@well-known-components/tracer-component'
import { createLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@well-known-components/metrics'
import { createSubgraphComponent } from '@well-known-components/thegraph-component'
import { createHttpTracerComponent } from '@well-known-components/http-tracer-component'
import {
  instrumentHttpServerWithRequestLogger,
  Verbosity,
} from '@well-known-components/http-requests-logger-component'
import { createPgComponent } from '@well-known-components/pg-component'
import { createFeaturesComponent } from '@well-known-components/features-component'
import { createContractsComponent } from './ports/contracts/component'
import { createFetchComponent } from './ports/fetcher'
import { createTransactionComponent } from './ports/transaction/component'
import { metricDeclarations } from './metrics'
import { AppComponents, GlobalContext } from './types'
import { createGelatoComponent } from './ports/gelato'
import { createOpenZeppelinComponent } from './ports/openzeppelin'
import { createRelayRouterComponent } from './ports/relay-router'

export async function initComponents(): Promise<AppComponents> {
  // default config from process.env + .env file
  const config = await createDotEnvConfigComponent(
    { path: ['.env.defaults', '.env'] },
    process.env
  )

  const cors = {
    origin: (await config.requireString('CORS_ORIGIN'))
      .split(';')
      .map((origin) => new RegExp(origin)),
    method: await config.getString('CORS_METHOD'),
  }

  const tracer = createTracerComponent()

  const logs = await createLogComponent({ config, tracer })
  const server = await createServerComponent<GlobalContext>(
    { config, logs },
    { cors, compression: {} }
  )
  createHttpTracerComponent({ server, tracer })
  instrumentHttpServerWithRequestLogger(
    { server, logger: logs },
    { verbosity: Verbosity.INFO }
  )
  const statusChecks = await createStatusCheckComponent({ config, server })
  const fetcher = await createFetchComponent({ tracer })
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

  const contracts = await createContractsComponent({
    config,
    fetcher,
    collectionsSubgraph,
  })

  // Initialize each provider whose required config is present so both can
  // coexist. The relay router arbitrates between them via the relay-provider
  // feature flag (and throws if neither is configured).
  let gelato: AppComponents['gelato']
  let openzeppelin: AppComponents['openzeppelin']

  if (await config.getString('GELATO_API_KEY')) {
    gelato = await createGelatoComponent({ logs, config, metrics })
  }

  if (await config.getString('OZ_RELAYER_URL')) {
    openzeppelin = await createOpenZeppelinComponent({
      logs,
      config,
      metrics,
      fetcher,
    })
  }

  const relayer = createRelayRouterComponent({
    logs,
    features,
    gelato,
    openzeppelin,
  })

  const transaction = createTransactionComponent({
    config,
    features,
    fetcher,
    logs,
    pg,
    relayer,
    contracts,
    metrics,
  })
  const globalLogger = logs.getLogger('transactions-server')

  return {
    config,
    logs,
    globalLogger,
    fetcher,
    features,
    metrics,
    server,
    pg,
    relayer,
    gelato,
    openzeppelin,
    transaction,
    contracts,
    collectionsSubgraph,
    statusChecks,
  }
}
