import { existsSync } from 'fs'
import { resolve } from 'path'
import { encodeFunctionData, Hex, parseAbi } from 'viem'
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
import { checkFunctionSelector } from '../../src/ports/transaction/validation/checkFunctionSelector'
import { IRelayRouterComponent } from '../../src/ports/relay-router/types'
import { SelfRelayUserAddressError } from '../../src/types/transactions/errors'
import { TransactionData } from '../../src/types/transactions/transactions'

// Hits the real OZ Relayer API. Skips automatically when OZ_RELAYER_URL,
// OZ_RELAYER_API_KEY, and OZ_RELAYER_ID are not present in the environment.
//
// Run only this spec:
//   npx jest test/integration/openzeppelin-relayer.spec.ts --runInBand
// Provide creds via .env, .env.prod, or inline:
//   OZ_RELAYER_URL=... OZ_RELAYER_API_KEY=... OZ_RELAYER_ID=... npx jest test/integration

const META_TX_ABI = parseAbi([
  'function executeMetaTransaction(address userAddress, bytes functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) returns (bytes)',
  'function executeMetaTransaction(address userAddress, bytes functionData, bytes signature) returns (bytes)',
])

const ENV_PATHS = ['.env.defaults', '.env', '.env.prod']
const REQUIRED_KEYS = ['OZ_RELAYER_URL', 'OZ_RELAYER_API_KEY', 'OZ_RELAYER_ID']

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

let openzeppelin: OpenZeppelinMetaTransactionComponent | null = null
let credsAvailable = false

beforeAll(async () => {
  const existingPaths = ENV_PATHS.map((p) => resolve(process.cwd(), p)).filter(
    existsSync
  )

  const config = await createDotEnvConfigComponent(
    { path: existingPaths },
    process.env
  )

  for (const key of REQUIRED_KEYS) {
    const value = await config.getString(key)
    if (!value) {
      // eslint-disable-next-line no-console
      console.warn(
        `[integration] skipping OZ relayer integration test: ${key} is not set`
      )
      return
    }
  }

  credsAvailable = true

  const logs = await createConsoleLogComponent({})
  const metrics = await createMetricsComponent(metricDeclarations, { config })
  const fetcher: IFetchComponent = {
    fetch(url: nodeFetch.RequestInfo, init?: nodeFetch.RequestInit) {
      return nodeFetch.default(url, init) as unknown as Promise<nodeFetch.Response>
    },
  }

  openzeppelin = await createOpenZeppelinComponent({
    config,
    logs,
    metrics,
    fetcher,
  })
})

const itIfCreds = (name: string, fn: () => Promise<void>) =>
  (credsAvailable ? it : it.skip)(name, fn)

describe('when hitting the real OZ Relayer API', () => {
  describe('and fetching the relayer addresses', () => {
    itIfCreds(
      'should return at least one address shaped like a 20-byte hex EOA',
      async () => {
        const addresses = await openzeppelin!.getRelayerAddresses()
        expect(addresses.size).toBeGreaterThan(0)
        for (const address of addresses) {
          expect(address).toMatch(/^0x[0-9a-f]{40}$/)
        }
      }
    )

    itIfCreds('should return all addresses lowercased', async () => {
      const addresses = await openzeppelin!.getRelayerAddresses()
      for (const address of addresses) {
        expect(address).toBe(address.toLowerCase())
      }
    })

    itIfCreds(
      'should hit the cache on the second call (no perceptible network delay)',
      async () => {
        await openzeppelin!.getRelayerAddresses()
        const start = Date.now()
        await openzeppelin!.getRelayerAddresses()
        const elapsed = Date.now() - start
        // Cache hits should resolve well under a real network round-trip.
        expect(elapsed).toBeLessThan(50)
      }
    )
  })

  describe('and running the validator end-to-end against the real relayer set', () => {
    let relayerEOA: Hex
    let components: {
      metrics: IMetricsComponent<keyof typeof metricDeclarations>
      relayer: Pick<IRelayRouterComponent, 'getRelayerAddresses'>
    }
    let incrementMock: jest.Mock

    beforeEach(async () => {
      if (!credsAvailable) return
      const addresses = await openzeppelin!.getRelayerAddresses()
      relayerEOA = [...addresses][0] as Hex
      incrementMock = jest.fn()
      components = {
        metrics: {
          increment: incrementMock,
        } as unknown as IMetricsComponent<keyof typeof metricDeclarations>,
        relayer: {
          getRelayerAddresses: () => Promise.resolve(addresses),
        },
      }
    })

    itIfCreds(
      'should reject calldata whose userAddress is one of the relayer EOAs',
      async () => {
        const transactionData: TransactionData = {
          from: '0x1111111111111111111111111111111111111111',
          params: [
            '0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0',
            dummyCalldata(relayerEOA),
          ],
        }

        await expect(
          checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            transactionData
          )
        ).rejects.toThrow(SelfRelayUserAddressError)
        expect(incrementMock).toHaveBeenCalledWith(
          'dcl_error_self_relay_user_address'
        )
      }
    )

    itIfCreds(
      'should resolve when userAddress is not in the relayer set',
      async () => {
        const transactionData: TransactionData = {
          from: '0x1111111111111111111111111111111111111111',
          params: [
            '0x7ad72b9f944ea9793cf4055d88f81138cc2c63a0',
            dummyCalldata(
              '0x9999999999999999999999999999999999999999' as Hex
            ),
          ],
        }

        await expect(
          checkFunctionSelector(
            components as Parameters<typeof checkFunctionSelector>[0],
            transactionData
          )
        ).resolves.not.toThrow()
        expect(incrementMock).not.toHaveBeenCalled()
      }
    )
  })
})
