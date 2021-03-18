import expect from 'expect'
import { Request, Response } from 'node-fetch'
import { TestComponents } from '../../src/types'
import {
  MetaTransactionResponse,
  SendTransactionRequest,
} from '../../src/types/transaction'
import { describeE2E } from '../harness/test-components-http-server'
import { describeTestE2E } from '../harness/test-components-mock'

describeE2E(
  'integration sanity tests using a real server backend',
  integrationSuite
)
describeTestE2E(
  'integration sanity tests using mocked test server',
  integrationSuite
)

function integrationSuite(getComponents: () => TestComponents) {
  it('responds empty list', async () => {
    const {
      fetcher: { fetch },
    } = getComponents()

    const r = await fetch(
      '/v1/transactions/0x1234563902c59f04f218384d80c951b412341231'
    )

    expect(r.status).toEqual(200)
    expect(await r.json()).toEqual([])
  })

  it('send tx', async () => {
    const {
      fetcher: { fetch, push },
    } = getComponents()

    const payload: SendTransactionRequest = {
      transactionData: {
        from: '0x1234563902c59f04f218384d80c951b412341231',
        params: ['0x1', '0x2'],
      },
    }

    // response
    const mockedResponse: MetaTransactionResponse = {
      flag: 0,
      log: 'log',
      txHash: '0x123456789',
    }

    push(
      new Request('https://api.biconomy.io/api/v2/meta-tx/native'),
      new Response(JSON.stringify(mockedResponse), {
        headers: { 'content-type': 'application/json' },
      })
    )

    const r = await fetch('/v1/transactions', {
      method: 'post',
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
      },
    })

    expect(r.status).toEqual(201)
  })
}
