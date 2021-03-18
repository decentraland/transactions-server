import { main } from '../../src/service'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  IFetchComponent,
} from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import nodeFetch from 'node-fetch'
import { createE2ERunner } from './test-helper'
import { GlobalContext, TestComponents } from '../../src/types'
import { metricDeclarations } from '../../src/metrics'
import { createDatabaseComponent } from '../../src/ports/database/component'
import { createMetricsComponent } from '@well-known-components/metrics'

let currentPort = 19000

// creates a "mocha-like" describe function to run tests using the test components
export const describeE2E = createE2ERunner<TestComponents>({
  main,
  initComponents,
})

async function initComponents(): Promise<TestComponents> {
  const logs = createLogComponent()

  const config = createConfigComponent({
    HTTP_SERVER_PORT: (currentPort + 1).toString(),
    HTTP_SERVER_HOST: '0.0.0.0',
  })

  const protocolHostAndProtocol = `http://${await config.requireString(
    'HTTP_SERVER_HOST'
  )}:${await config.requireNumber('HTTP_SERVER_PORT')}`

  const server = await createServerComponent<GlobalContext>(
    { logs, config },
    {}
  )

  const fetcher: IFetchComponent = {
    async fetch(url, initRequest?) {
      if (typeof url == 'string' && url.startsWith('/')) {
        return nodeFetch(protocolHostAndProtocol + url, { ...initRequest })
      } else {
        return nodeFetch(url, initRequest)
      }
    },
  }

  const metrics = await createMetricsComponent(metricDeclarations, {
    server,
    config,
  })
  const globalLogger = logs.getLogger('test-e2e-global-logger')
  const database = await createDatabaseComponent(
    { logs },
    { filename: ':memory:' }
  )

  return { logs, config, server, fetcher, metrics, database, globalLogger }
}
