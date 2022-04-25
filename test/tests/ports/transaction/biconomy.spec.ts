import { Response } from 'node-fetch'
import {
  MetaTransactionCode,
  MetaTransactionResponse,
  MetaTransactionStatus,
  TransactionData,
} from '../../../../src/ports/transaction/types'
import { test } from '../../../components'

test('biconomy flow test', function ({ components, stubComponents }) {
  it('sanity test', async () => {
    const { config, transaction } = components
    const { metrics, fetcher } = stubComponents

    const tx: TransactionData = { from: '0x1', params: ['1', '2'] }

    const url = await config.requireString('BICONOMY_API_URL')

    const response: MetaTransactionResponse = {
      flag: MetaTransactionStatus.OK,
      log: 'log',
      txHash: 'METATX',
    }

    fetcher.fetch
      .withArgs(url)
      .returns(Promise.resolve(new Response(JSON.stringify(response))))

    const result = await transaction.sendMetaTransaction(tx)

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
    const { config, transaction } = components
    const { metrics, fetcher } = stubComponents

    const tx: TransactionData = { from: '0x1', params: ['1', '2'] }

    const url = await config.requireString('BICONOMY_API_URL')

    fetcher.fetch
      .withArgs(url)
      .returns(Promise.resolve(new Response('<html>', { status: 503 })))

    await expect(transaction.sendMetaTransaction(tx)).rejects.toThrow(
      /An error occurred trying to send the meta transaction/
    )

    expect(
      metrics.increment.calledOnceWith(
        'dcl_error_relay_transactions_biconomy',
        {
          contract: tx.params[0],
        }
      )
    ).toEqual(true)
  })

  it('UNPREDICTABLE_GAS_LIMIT', async () => {
    const { config, transaction } = components
    const { metrics, fetcher } = stubComponents

    const tx: TransactionData = { from: '0x1', params: ['1', '2'] }

    const url = await config.requireString('BICONOMY_API_URL')

    fetcher.fetch.withArgs(url).returns(
      Promise.resolve(
        new Response('code=UNPREDICTABLE_GAS_LIMIT', {
          status: MetaTransactionStatus.EXPECTATION_FAILED,
        })
      )
    )

    await expect(transaction.sendMetaTransaction(tx)).rejects.toThrow(
      /An error occurred trying to send the meta transaction/
    )

    expect(
      metrics.increment.calledOnceWith(
        'dcl_error_cannot_estimate_gas_transactions_biconomy',
        {
          contract: tx.params[0],
        }
      )
    ).toEqual(true)
  })

  it('CONFLICT', async () => {
    const { config, transaction } = components
    const { metrics, fetcher } = stubComponents

    const tx: TransactionData = { from: '0x1', params: ['1', '2'] }

    const url = await config.requireString('BICONOMY_API_URL')

    fetcher.fetch
      .withArgs(url)
      .returns(
        Promise.resolve(
          new Response(
            JSON.stringify({
              message: 'code=CONFLICT',
              code: MetaTransactionCode.DAPP_LIMIT,
            }),
            { status: MetaTransactionStatus.CONFLICT }
          )
        )
      )

    await expect(transaction.sendMetaTransaction(tx)).rejects.toThrow(
      /An error occurred trying to send the meta transaction/
    )

    expect(
      metrics.increment.calledOnceWith(
        'dcl_error_limit_reached_transactions_biconomy',
        {
          contract: tx.params[0],
          code: MetaTransactionCode.DAPP_LIMIT,
        }
      )
    ).toEqual(true)
  })
})
