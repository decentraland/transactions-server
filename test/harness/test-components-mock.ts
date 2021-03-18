import { main } from '../../src/service'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import {
  createTestServerComponent,
  IFetchComponent,
} from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { createE2ERunner } from './test-helper'
import { GlobalContext, TestComponents } from '../../src/types'
import { metricDeclarations } from '../../src/metrics'
import { createTestMetricsComponent } from '@well-known-components/metrics'
import { createDatabaseComponent } from '../../src/ports/database/component'

// creates a "mocha-like" describe function to run tests using the test components
export const describeTestE2E = createE2ERunner({
  main,
  initComponents,
})

async function initComponents(): Promise<TestComponents> {
  const logs = createLogComponent()

  const config = createConfigComponent({})

  const server = createTestServerComponent<GlobalContext>()

  const fetcher: IFetchComponent = server

  const metrics = createTestMetricsComponent(metricDeclarations)

  const globalLogger = logs.getLogger('test-e2e-global-logger')

  const database = await createDatabaseComponent(
    { logs },
    { filename: ':memory:' }
  )

  return { logs, config, server, fetcher, metrics, database, globalLogger }
}
