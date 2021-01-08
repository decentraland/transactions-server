import { GlobalContext } from '../types'
import { handleThings } from './handlers'

export function setupRoutes(globalContext: GlobalContext) {
  const { components } = globalContext
  const { config, server } = components

  server.get(
    globalContext,
    addAPIVersion('/transactions/:user_address'),
    handleThings(components)
  )

  function addAPIVersion(uri: string) {
    return `/${config.getString('API_VERSION')}${uri}`
  }
}
