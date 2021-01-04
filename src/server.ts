import { env } from 'decentraland-commons'

import { AppRouter } from './App'
import { TransactionRouter } from './Transaction'
import { ExpressApp } from './common/ExpressApp'
import { withLogger } from './middleware'

const SERVER_PORT = env.get('SERVER_PORT', '5000')
const API_VERSION = env.get('API_VERSION', 'v1')
const CORS_ORIGIN = env.get('CORS_ORIGIN', '*')
const CORS_METHOD = env.get('CORS_METHOD', '*')

const app = new ExpressApp()

app
  .use(withLogger())
  .useJSON()
  .useVersion(API_VERSION)
  .useCORS(CORS_ORIGIN, CORS_METHOD)

// Mount routers
new AppRouter(app).mount()
new TransactionRouter(app).mount()

/* Start the server only if run directly */
if (require.main === module) {
  startServer().catch(console.error)
}

async function startServer() {
  return app.listen(SERVER_PORT)
}
