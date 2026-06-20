import path from 'path'
import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  createStatusCheckComponent,
  instrumentHttpServerWithPromClientRegistry,
} from '@dcl/http-server'
import { createTracerComponent } from '@well-known-components/tracer-component'
import { createLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@dcl/metrics'
import { createSubgraphComponent } from '@dcl/thegraph-component'
import { createHttpTracerComponent } from '@dcl/http-tracer-component'
import {
  instrumentHttpServerWithRequestLogger,
  Verbosity,
} from '@well-known-components/http-requests-logger-component'
import { createPgComponent } from '@dcl/pg-component'
import { createFeaturesComponent } from '@dcl/features-component'
import { createTracedFetcherComponent } from '@dcl/traced-fetch-component'
import { createContractsComponent } from './ports/contracts/component'
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

  const corsMethod = await config.getString('CORS_METHOD')
  const cors = {
    origin: (await config.requireString('CORS_ORIGIN'))
      .split(';')
      .map((origin) => new RegExp(origin)),
    methods: corsMethod
      ? corsMethod.split(',').map((method) => method.trim())
      : undefined,
  }

  const tracer = createTracerComponent()

  const logs = await createLogComponent({ config, tracer })
  const server = await createServerComponent<GlobalContext>(
    { config, logs },
    { cors }
  )
  createHttpTracerComponent({ server, tracer })
  // The HTTP requests logger still types its server against the
  // node-fetch-flavoured @well-known-components interfaces. It only reads the
  // request method/url and the response status at runtime, so it is
  // structurally compatible with the native-fetch core http-server; the cast
  // bridges the two type worlds.
  instrumentHttpServerWithRequestLogger(
    {
      server: server as unknown as Parameters<
        typeof instrumentHttpServerWithRequestLogger
      >[0]['server'],
      logger: logs,
    },
    { verbosity: Verbosity.INFO }
  )
  const statusChecks = await createStatusCheckComponent({ config, server })
  const fetcher = await createTracedFetcherComponent({ tracer })
  const features = await createFeaturesComponent(
    {
      config,
      logs,
      fetch: fetcher,
    },
    await config.requireString('TRANSACTIONS_SERVER_URL')
  )
  const metrics = await createMetricsComponent(metricDeclarations, {
    config,
  })
  // The metrics component no longer wires the `/metrics` endpoint or the HTTP
  // request instrumentation by itself (that was previously done by passing
  // `server` to `createMetricsComponent`). With the core components split this
  // is wired explicitly through the http-server helper.
  await instrumentHttpServerWithPromClientRegistry({
    server,
    config,
    metrics,
    registry: metrics.registry!,
  })

  // The pg component resolves its connection from config
  // (PG_COMPONENT_PSQL_CONNECTION_STRING or the individual PG_COMPONENT_PSQL_*
  // variables) and runs migrations against that pool, so the migration options
  // no longer take a `databaseUrl`.
  const pg = await createPgComponent(
    { logs, config, metrics },
    {
      migration: {
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
