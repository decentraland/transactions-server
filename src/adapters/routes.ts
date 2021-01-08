import { GlobalContext } from '../types'
import { getUserTransactions, sendTransaction } from './handlers'

export async function setupRoutes(globalContext: GlobalContext) {
  const { components } = globalContext
  const { config, server } = components

  server.get(
    globalContext,
    await addAPIVersion('/transactions/:user_address'),
    getUserTransactions(components)
  )

  server.post(
    globalContext,
    await addAPIVersion('/transactions'),
    sendTransaction(components)
  )

  async function addAPIVersion(uri: string) {
    const apiVersion = await config.requireString('API_VERSION')
    return `/${apiVersion}${uri}`
  }
}
