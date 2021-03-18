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
import {
  createTestFetchComponent,
  ITestFetchComponent,
} from '../../src/ports/fetcher'
import { SendTransactionRequest } from '../../src/types/transaction'

describe('ping-controller-unit', () => {
  it('send one transaction', async () => {
    const url = new URL('https://localhost/v1/transactions')
    const metrics = createTestMetricsComponent(metricDeclarations)
    const database: IDatabaseComponent = {
      run: sinon.stub(),
      query: sinon.stub() as any,
      migrate: sinon.stub(),
    }
    const fetcher: ITestFetchComponent = await createTestFetchComponent({
      localhost: 'localhost',
    })

    const config = createConfigComponent({})
    const globalLogger = createLogComponent().getLogger('test-logger')

    expect(
      (await metrics.getValue('dcl_sent_transactions_biconomy')).values
    ).toEqual([])

    const payload: SendTransactionRequest = {
      transactionData: {
        from: '0x1234563902c59f04f218384d80c951b412341231',
        params: ['0x1', '0x2'],
      },
    }

    expect(
      await sendTransaction({
        url,
        components: { metrics, database, globalLogger, config, fetcher },
        params: {},
        request: new Request(url, {
          body: JSON.stringify(payload),
          method: 'post',
        }),
      })
    ).toEqual({ body: url.pathname })
    expect(
      (await metrics.getValue('dcl_sent_transactions_biconomy')).values
    ).toEqual([{ labels: { pathname: '/well-known-components' }, value: 1 }])
  })
})
