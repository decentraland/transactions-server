import { IFetchComponent } from '@well-known-components/http-server'
import * as nodeFetch from 'node-fetch'

// Note:
// fetcher component may be encapsulated in @well-known-components/fetcher
// in a future. for the time being, given it's simplicity and ease of configuration
// it can be implemented as follow to enable customizations:
export async function createFetchComponent() {
  const fetch: IFetchComponent = {
    async fetch(
      url: nodeFetch.RequestInfo,
      init?: nodeFetch.RequestInit
    ): Promise<nodeFetch.Response> {
      return nodeFetch.default(url, init)
    },
  }

  return fetch
}
