import { test } from '../components'
import { Response } from 'node-fetch'
import { sendMetaTransaction } from '../../src/logic/transaction'
import {
  MetaTransactionResponse,
  TransactionData,
} from '../../src/types/transaction'

test('biconomy flow test 1', function ({ components, stubComponents }) {
  it('sanity test', async () => {
    const { config } = components
    const { metrics, fetcher } = stubComponents

    const tx: TransactionData = { from: '0x1', params: ['1', '2'] }

    const url = await config.requireString('BICONOMY_API_URL')

    const response: MetaTransactionResponse = {
      flag: 0,
      log: 'log',
      txHash: 'METATX',
    }

    fetcher.fetch
      .withArgs(url)
      .returns(Promise.resolve(new Response(JSON.stringify(response))))

    const result = await sendMetaTransaction({ metrics, fetcher, config }, tx)

    expect(fetcher.fetch.calledOnce).toEqual(true)
    expect(fetcher.fetch.getCalls()[0].args).toEqual([
      url,
      {
        headers: {
          'content-type': 'application/json',
          'x-api-key': '1234abc',
        },
        body: '{"apiId":"1234","from":"0x1","params":["1","2"]}',
        method: 'POST',
      },
    ])

    expect({ result }).toEqual({ result: response.txHash })

    expect(
      metrics.increment.calledOnceWith('dcl_sent_transactions_biconomy', {
        contract: tx.params[0],
      })
    ).toEqual(true)
  })

  it('bad gateway', async () => {
    const { config } = components
    const { metrics, fetcher } = stubComponents

    const tx: TransactionData = { from: '0x1', params: ['1', '2'] }

    const url = await config.requireString('BICONOMY_API_URL')

    fetcher.fetch
      .withArgs(url)
      .returns(Promise.resolve(new Response('<html>', { status: 503 })))

    await expect(() =>
      sendMetaTransaction({ metrics, fetcher, config }, tx)
    ).rejects.toThrow(/An error occurred trying to send the meta transaction/)

    expect(
      metrics.increment.calledOnceWith('dcl_error_relay_transactions_biconomy', {
        contract: tx.params[0]
      })
    ).toEqual(true)
  })

  it('UNPREDICTABLE_GAS_LIMIT', async () => {
    const { config } = components
    const { metrics, fetcher } = stubComponents

    const tx: TransactionData = { from: '0x1', params: ['1', '2'] }

    const url = await config.requireString('BICONOMY_API_URL')

    fetcher.fetch
      .withArgs(url)
      .returns(Promise.resolve(new Response('code=UNPREDICTABLE_GAS_LIMIT', { status: 503 })))

    await expect(() =>
      sendMetaTransaction({ metrics, fetcher, config }, tx)
    ).rejects.toThrow(/An error occurred trying to send the meta transaction/)

    expect(
      metrics.increment.calledOnceWith('dcl_error_cannot_estimate_gas_transactions_biconomy', {
        contract: tx.params[0]
      })
    ).toEqual(true)
  })
})
