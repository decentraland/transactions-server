import * as nodeFetch from 'node-fetch'
import type { IFetchComponent } from '@well-known-components/http-server'
import type { ITracerComponent } from '@well-known-components/interfaces'

// Note:
// fetcher component may be encapsulated in @well-known-components/fetcher
// in a future. for the time being, given it's simplicity and ease of configuration
// it can be implemented as follow to enable customizations:
export async function createFetchComponent(components: {
  tracer: ITracerComponent
}): Promise<IFetchComponent> {
  const { tracer } = components
  const fetch: IFetchComponent = {
    async fetch(
      url: nodeFetch.RequestInfo,
      init?: nodeFetch.RequestInit
    ): Promise<nodeFetch.Response> {
      const headers: nodeFetch.HeadersInit = { ...init?.headers } as {
        [key: string]: string
      }
      const traceParent = tracer.isInsideOfTraceSpan()
        ? tracer.getTraceChildString()
        : null
      if (traceParent) {
        headers.traceparent = traceParent
        const traceState = tracer.getTraceStateString()
        if (traceState) {
          headers.tracestate = traceState
        }
      }
      return nodeFetch.default(url, { ...init, headers })
    },
  }

  return fetch
}

// TEST COMPONENT
export type ITestFetchComponent = IFetchComponent & {
  push(request: nodeFetch.RequestInit, response: nodeFetch.Response): void
}

// NOTICE: this test component will be later moved to well-known-components
export async function createTestFetchComponent(options: {
  localhost: string
}): Promise<ITestFetchComponent> {
  const mocks: Array<{
    req: nodeFetch.RequestInit
    res: nodeFetch.Response
  }> = []

  return {
    async fetch(
      url: nodeFetch.RequestInfo,
      initRequest?: nodeFetch.RequestInit
    ): Promise<nodeFetch.Response> {
      if (typeof url === 'string' && url.startsWith('/')) {
        return nodeFetch.default(options.localhost + url, { ...initRequest })
      } else {
        if (!mocks.length) {
          throw new Error(
            `No mock was set for this fetch call ${JSON.stringify({
              url,
              initRequest,
            })}`
          )
        }

        const mock = mocks.shift()
        if (!mock) {
          throw new Error('Mock queue unexpectedly empty')
        }

        // TODO: assert that the request matches mock.req

        return mock.res
      }
    },
    push(req, res) {
      mocks.push({ req, res })
    },
  }
}
