import { existsSync } from 'fs'
import { resolve } from 'path'
import { encodeFunctionData, Hex } from 'viem'
import * as nodeFetch from 'node-fetch'
import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import { createConsoleLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@well-known-components/metrics'
import {
  IFetchComponent,
  IMetricsComponent,
} from '@well-known-components/interfaces'
import { metricDeclarations } from '../../src/metrics'
import { createOpenZeppelinComponent } from '../../src/ports/openzeppelin'
import { OpenZeppelinMetaTransactionComponent } from '../../src/ports/openzeppelin/types'
import { META_TX_ABI } from '../../src/ports/transaction/validation/abis'
import { checkFunctionSelector } from '../../src/ports/transaction/validation/checkFunctionSelector'
import { IRelayRouterComponent } from '../../src/ports/relay-router/types'
import { SelfRelayUserAddressError } from '../../src/types/transactions/errors'
import { TransactionData } from '../../src/types/transactions/transactions'

// Hits the real OZ Relayer API. Requires OZ_RELAYER_URL, OZ_RELAYER_API_KEY,
// and OZ_RELAYER_ID to be loaded (via shell env, .env, or .env.prod). The
// credential-absence path is covered by the unit tests; this spec assumes
// creds are present and will fail loudly otherwise.
//
// Run only this spec:
//   npx jest test/integration/openzeppelin-relayer.spec.ts --runInBand

const ENV_PATHS = ['.env.defaults', '.env', '.env.prod']

const dummyCalldata = (userAddress: Hex): string =>
  encodeFunctionData({
    abi: META_TX_ABI,
    functionName: 'executeMetaTransaction',
    args: [
      userAddress,
      ('0x095ea7b3' + '00'.repeat(64)) as Hex,
      `0x${'00'.repeat(32)}` as Hex,
      `0x${'00'.repeat(32)}` as Hex,
      27,
    ],
  })

describe('when hitting the real OZ Relayer API', () => {
  let openzeppelin: OpenZeppelinMetaTransactionComponent

  beforeEach(async () => {
    const existingPaths = ENV_PATHS.map((p) =>
      resolve(process.cwd(), p)
    ).filter(existsSync)
    const config = await createDotEnvConfigComponent(
      { path: existingPaths },
      process.env
    )
    const logs = await createConsoleLogComponent({})
    const metrics = await createMetricsComponent(metricDeclarations, { config })
    const fetcher: IFetchComponent = {
      fetch(url: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit) {
        return nodeFetch.default(
          url,
          init
        ) as unknown as Promise<nodeFetch.Response>
      },
    }
    openzeppelin = await createOpenZeppelinComponent({
      config,
      logs,
      metrics,
      fetcher,
    })
  })

  describe('and fetching the relayer addresses', () => {
    it('should return at least one address', async () => {
      const addresses = await openzeppelin.getRelayerAddresses()
      expect(addresses.size).toBeGreaterThan(0)
    })

    it('should return only 20-byte hex addresses', async () => {
      const addresses = await openzeppelin.getRelayerAddresses()
      for (const address of addresses) {
        expect(address).toMatch(/^0x[0-9a-f]{40}$/)
      }
    })

    it('should return all addresses lowercased', async () => {
      const addresses = await openzeppelin.getRelayerAddresses()
      for (const address of addresses) {
        expect(address).toBe(address.toLowerCase())
      }
    })

    it('should resolve the second call in under 50ms (cache hit)', async () => {
      await openzeppelin.getRelayerAddresses()
      const start = Date.now()
      await openzeppelin.getRelayerAddresses()
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(50)
    })
  })

  describe('and running the validator end-to-end against the real relayer set', () => {
    let relayerEOA: Hex
    let incrementMock: jest.Mock
    let getRelayerAddressesMock: jest.Mock
    let components: {
      metrics: IMetricsComponent<keyof typeof metricDeclarations>
      relayer: Pick<IRelayRouterComponent, 'getRelayerAddresses'>
    }

    beforeEach(async () => {
      const addresses = await openzeppelin.getRelayerAddresses()
      relayerEOA = [...addresses][0] as Hex
      incrementMock = jest.fn()
      getRelayerAddressesMock = jest.fn().mockResolvedValue(addresses)
      components = {
        metrics: {
          increment: incrementMock,
        } as unknown as IMetricsComponent<keyof typeof metricDeclarations>,
        relayer: {
          getRelayerAddresses: getRelayerAddressesMock,
        },
      }
    })

    afterEach(() => {
      jest.resetAllMocks()
    })

    describe('and the userAddress matches one of the relayer EOAs', () => {
      let transactionData: TransactionData

      beforeEach(() => {
        transactionData = {
          from: '0x1111111111111111111111111111111111111111',
          params: [
            '0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0',
            dummyCalldata(relayerEOA),
          ],
        }
      })

      it('should reject with SelfRelayUserAddressError', async () => {
        await expect(
          checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            transactionData
          )
        ).rejects.toThrow(SelfRelayUserAddressError)
      })

      it('should increment the dcl_error_self_relay_user_address counter', async () => {
        await expect(
          checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            transactionData
          )
        ).rejects.toThrow()
        expect(incrementMock).toHaveBeenCalledWith(
          'dcl_error_self_relay_user_address'
        )
      })
    })

    describe('and the userAddress is not in the relayer set', () => {
      let transactionData: TransactionData

      beforeEach(() => {
        transactionData = {
          from: '0x1111111111111111111111111111111111111111',
          params: [
            '0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0',
            dummyCalldata('0x9999999999999999999999999999999999999999' as Hex),
          ],
        }
      })

      it('should resolve without throwing', async () => {
        await expect(
          checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            transactionData
          )
        ).resolves.not.toThrow()
      })

      it('should not increment any rejection counter', async () => {
        await checkFunctionSelector(
          components as Parameters<typeof checkFunctionSelector>[0],
          transactionData
        )
        expect(incrementMock).not.toHaveBeenCalled()
      })
    })
  })
})
