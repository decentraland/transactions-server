import { Response } from 'node-fetch'
import { IFetchComponent } from '@well-known-components/http-server'
import { IConfigComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { createContractsComponent } from '../../../../src/ports/contracts/component'
import {
  IContractsComponent,
  RemoteCollection,
} from '../../../../src/ports/contracts/types'

let requireNumberMock: jest.Mock
let requireStringMock: jest.Mock
let mockedQuery: jest.Mock
let mockedFetch: jest.Mock
let address: string
let contracts: IContractsComponent
let components: {
  config: IConfigComponent
  collectionsSubgraph: ISubgraphComponent
  fetcher: IFetchComponent
}

beforeEach(async () => {
  mockedQuery = jest.fn()
  mockedFetch = jest.fn()
  requireNumberMock = jest.fn().mockImplementation((key: string) => {
    switch (key) {
      case 'COLLECTIONS_FETCH_INTERVAL_MS':
        return 1000
      case 'COLLECTIONS_CHAIN_ID':
        return 80002
      default:
        throw new Error(`Unknown key ${key}`)
    }
  })
  requireStringMock = jest.fn().mockImplementation((key: string) => {
    switch (key) {
      case 'CONTRACT_ADDRESSES_URL':
        return 'https://contracts.decentraland.org/addresses.json'
      default:
        throw new Error(`Unknown key ${key}`)
    }
  })
  components = {
    config: {
      requireString: requireStringMock,
      requireNumber: requireNumberMock,
      getString: jest.fn(),
      getNumber: jest.fn(),
    },
    collectionsSubgraph: {
      query: mockedQuery,
    },
    fetcher: {
      fetch: mockedFetch,
    },
  }
  address = '0xabc123123'
  contracts = await createContractsComponent(components)
})

describe('when checking for a valid contract address', () => {
  describe('when the address is a valid collection and whitelisted', () => {
    beforeEach(() => {
      mockedQuery.mockResolvedValueOnce({ collections: [{ id: address }] })
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: () => ({ amoy: { SomeContract: address } }),
      })
    })

    it('should return true', () => {
      return expect(contracts.isValidAddress(address)).resolves.toBe(true)
    })
  })

  describe('when the address is a valid collection', () => {
    beforeEach(() => {
      mockedQuery.mockResolvedValueOnce({ collections: [{ id: address }] })
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: () => ({ amoy: {} }),
      })
    })

    it('should return true', async () => {
      expect(await contracts.isValidAddress(address)).toBe(true)
    })
  })

  describe('when the address is a whitelisted', () => {
    beforeEach(() => {
      mockedQuery.mockResolvedValueOnce({ collections: [] })
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: () => ({ amoy: { SomeContract: address } }),
      })
    })

    it('should return true', async () => {
      expect(await contracts.isValidAddress(address)).toBe(true)
    })
  })

  describe('when the address is invalid and not whitelisted', () => {
    beforeEach(() => {
      mockedQuery.mockResolvedValueOnce({ collections: [] })
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: () => ({ amoy: {} }),
      })
    })

    it('should return true', async () => {
      expect(await contracts.isValidAddress(address)).toBe(false)
    })
  })
})

describe('when checking if an address belongs to a collection', () => {
  let collections: RemoteCollection[]

  beforeEach(() => {
    collections = [{ id: address }]
    mockedQuery.mockImplementationOnce(async (_query, variables) => ({
      collections: variables!.id === address ? collections : [],
    }))
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

      expect(mockedQuery).toBeCalledWith(contracts.getCollectionQuery(), {
        id: address,
      })
      expect(mockedQuery).toBeCalledTimes(1)
    })
  })
})

describe('when checking for a whitelisted address', () => {
  const url = 'https://contracts.decentraland.org/addresses.json'

  describe('when the remote resource fails', () => {
    beforeEach(() => {
      mockedFetch.mockResolvedValueOnce(new Response('', { status: 500 }))
    })

    it('should throw an error', async () => {
      await expect(contracts.isWhitelisted('')).rejects.toEqual(
        new Error(`Could not get the whitelisted addresses from ${url}`)
      )
    })
  })

  describe('when the remote resource returns data', () => {
    beforeEach(() => {
      const body = JSON.stringify({
        amoy: {
          SomeContract: address,
        },
      })

      mockedFetch.mockResolvedValueOnce(new Response(body, { status: 200 }))
    })

    describe('and the address is whitelisted', () => {
      it('should return true', async () => {
        expect(await contracts.isWhitelisted(address)).toBe(true)
      })
    })

    describe('and the address is not whitelisted', () => {
      it('should return true', async () => {
        expect(await contracts.isWhitelisted('nonsense')).toBe(false)
      })
    })

    describe('and the method is called more than once', () => {
      it('should cache the subsequent requests', async () => {
        await contracts.isWhitelisted(address)
        await contracts.isWhitelisted(address)
        await contracts.isWhitelisted(address)

        expect(mockedFetch).toHaveBeenCalledTimes(1)
      })
    })
  })
})
