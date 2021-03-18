import { createTestMetricsComponent } from '@well-known-components/metrics'
import sinon from 'sinon'
import expect from 'expect'
import { sendTransaction } from '../../src/controllers/handlers'
import { metricDeclarations } from '../../src/metrics'
import { IDatabaseComponent } from '../../src/ports/database/types'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import { createLogComponent } from '@well-known-components/logger'
import { IFetchComponent } from '@well-known-components/http-server'
import { Request } from 'node-fetch'

describe('ping-controller-unit', () => {
  it('must return the pathname of a URL', async () => {
    const url = new URL('https://github.com/well-known-components')
    const metrics = createTestMetricsComponent(metricDeclarations)
    const database: IDatabaseComponent = {
      run: sinon.stub(),
      query: sinon.stub() as any,
      start: sinon.stub(),
      stop: sinon.stub(),
      migrate: sinon.stub(),
    }
    const fetcher: IFetchComponent = {
      fetch: sinon.stub()
    }

    const config = createConfigComponent({})
    const globalLogger = createLogComponent().getLogger('test-logger')

    expect(
      (await metrics.getValue('dcl_sent_transactions_biconomy')).values
    ).toEqual([])
    expect(
      await sendTransaction({
        url,
        components: { metrics, database, globalLogger, config, fetcher },
        params: {},
        request: new Request(''),
      })
    ).toEqual({ body: url.pathname })
    expect(
      (await metrics.getValue('dcl_sent_transactions_biconomy')).values
    ).toEqual([{ labels: { pathname: '/well-known-components' }, value: 1 }])
  })
})
