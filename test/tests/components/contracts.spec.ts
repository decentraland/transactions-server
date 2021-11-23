import { Response } from 'node-fetch'
import { ChainName } from '@dcl/schemas'
import { test } from '../../components'
import { createContractsComponent } from '../../../src/ports/contracts/component'
import {
  IContractsComponent,
  RemoteCollection,
} from '../../../src/ports/contracts/types'

test('contracts component', function ({ components, stubComponents }) {
  describe('when checking for a valid contract address', () => {
    let contracts: IContractsComponent
    let address: string

    beforeEach(() => {
      const { config, logs, collectionsSubgraph } = components
      const { fetcher } = stubComponents

      address = '0xabc123123'
      contracts = createContractsComponent({
        config,
        logs,
        fetcher,
        collectionsSubgraph,
      })
    })

    afterEach(() => {
      jest.resetAllMocks()
      contracts.clearCache()
    })

    describe('when the address is a valid collection and whitelisted', () => {
      beforeEach(() => {
        jest.spyOn(contracts, 'isCollectionAddress').mockResolvedValueOnce(true)
        jest.spyOn(contracts, 'isWhitelisted').mockResolvedValueOnce(true)
      })

      it('should return true', async () => {
        expect(await contracts.isValidContractAddress(address)).toBe(true)
      })
    })

    describe('when the address is a valid collection', () => {
      beforeEach(() => {
        jest.spyOn(contracts, 'isCollectionAddress').mockResolvedValueOnce(true)
        jest.spyOn(contracts, 'isWhitelisted').mockResolvedValueOnce(false)
      })

      it('should return true', async () => {
        expect(await contracts.isValidContractAddress(address)).toBe(true)
      })
    })

    describe('when the address is a whitelisted', () => {
      beforeEach(() => {
        jest
          .spyOn(contracts, 'isCollectionAddress')
          .mockResolvedValueOnce(false)
        jest.spyOn(contracts, 'isWhitelisted').mockResolvedValueOnce(true)
      })

      it('should return true', async () => {
        expect(await contracts.isValidContractAddress(address)).toBe(true)
      })
    })

    describe('when the address is invalid', () => {
      beforeEach(() => {
        jest
          .spyOn(contracts, 'isCollectionAddress')
          .mockResolvedValueOnce(false)
        jest.spyOn(contracts, 'isWhitelisted').mockResolvedValueOnce(false)
      })

      it('should return true', async () => {
        expect(await contracts.isValidContractAddress(address)).toBe(false)
      })
    })
  })

  describe('when checking if an address belongs to a collection', () => {
    let contracts: IContractsComponent
    let address: string
    let collections: RemoteCollection[]
    let subgraphMock: jest.SpyInstance

    beforeEach(() => {
      const { config, logs, collectionsSubgraph } = components
      const { fetcher } = stubComponents

      collections = [{ id: address }]

      subgraphMock = jest
        .spyOn(collectionsSubgraph, 'query')
        .mockImplementationOnce(async (_query, variables) => ({
          collections: variables!.id === address ? collections : [],
        }))

      address = '0xabc123123'
      contracts = createContractsComponent({
        config,
        logs,
        fetcher,
        collectionsSubgraph,
      })
    })

    afterEach(() => {
      jest.resetAllMocks()
      contracts.clearCache()
    })

    describe('when the collection address is valid', () => {
      it('should return true', async () => {
        expect(await contracts.isCollectionAddress(address)).toBe(true)
      })
    })

    describe('when the collection address is valid', () => {
      it('should return false', async () => {
        expect(await contracts.isCollectionAddress('some nonsense')).toBe(false)
      })
    })

    describe('when the method is called more than once', () => {
      it('should cache the subsequent requests', async () => {
        await contracts.isCollectionAddress(address)
        await contracts.isCollectionAddress(address)

        expect(subgraphMock).toBeCalledWith(contracts.getCollectionQuery(), {
          id: address,
        })
        expect(subgraphMock).toBeCalledTimes(1)
      })
    })
  })

  describe('when checking for a whitelisted address', () => {
    const url = 'https://contracts.decentraland.org/addresses.json'

    describe('when the remote resource fails', () => {
      let contracts: IContractsComponent

      beforeEach(() => {
        const { config, logs, collectionsSubgraph } = components
        const { fetcher } = stubComponents

        fetcher.fetch
          .withArgs(url, {
            headers: { 'content-type': 'application/json' },
            method: 'GET',
          })
          .returns(Promise.resolve(new Response('', { status: 500 })))

        contracts = createContractsComponent({
          config,
          logs,
          fetcher,
          collectionsSubgraph,
        })
      })

      afterEach(() => {
        contracts.clearCache()
      })

      it('should throw an error', async () => {
        await expect(contracts.isWhitelisted('')).rejects.toEqual(
          new Error(`Could not get the whitelisted addresses from ${url}`)
        )
      })
    })

    describe('when the remote resource returns data', () => {
      let contracts: IContractsComponent
      let address: string
      let fetcher: any

      beforeEach(() => {
        const { config, logs, collectionsSubgraph } = components

        fetcher = stubComponents.fetcher
        address = '0xabc123'

        const url = 'https://contracts.decentraland.org/addresses.json'
        const body = JSON.stringify({
          [ChainName.MATIC_MAINNET.toLowerCase()]: {
            SomeContract: address,
          },
        })

        fetcher.fetch
          .withArgs(url, {
            headers: { 'content-type': 'application/json' },
            method: 'GET',
          })
          .returns(Promise.resolve(new Response(body, { status: 200 })))

        contracts = createContractsComponent({
          config,
          logs,
          fetcher,
          collectionsSubgraph,
        })
      })

      afterEach(() => {
        contracts.clearCache()
      })

      describe('when the address is whitelisted', () => {
        it('should return true', async () => {
          expect(await contracts.isWhitelisted(address)).toBe(true)
        })
      })

      describe('when the address is not whitelisted', () => {
        it('should return true', async () => {
          expect(await contracts.isWhitelisted('nonsense')).toBe(false)
        })
      })

      describe('when the method is called more than once', () => {
        it('should cache the subsequent requests', async () => {
          const { fetcher } = stubComponents

          await contracts.isWhitelisted(address)
          await contracts.isWhitelisted(address)
          await contracts.isWhitelisted(address)

          expect(fetcher.fetch.calledOnce).toBe(true)
        })
      })
    })
  })
})
