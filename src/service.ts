import { setupRoutes } from './controllers/routes'
import { AppComponents, GlobalContext } from './types'
import { Lifecycle as _ } from '@well-known-components/interfaces'

// this function wires the business logic (adapters & controllers) with the components (ports)
export async function main(program: _.EntryPointParameters<AppComponents>) {
  const { components, startComponents } = program
  const globalContext: GlobalContext = {
    components,
  }

  const router = await setupRoutes(globalContext)

  components.server.use(router.middleware())
  components.server.setContext(globalContext)

  // start components (server listener, db, etc...)
  await startComponents()
}
