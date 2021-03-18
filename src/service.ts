import { setupRoutes } from './controllers/routes'
import { AppComponents, GlobalContext } from './types'

// this function wires the business logic (adapters & controllers) with the components (ports)
export async function main(components: AppComponents) {
  const globalContext: GlobalContext = {
    components,
  }

  const router = await setupRoutes(globalContext)

  components.server.use(router.middleware())
  components.server.setContext(globalContext)
}
