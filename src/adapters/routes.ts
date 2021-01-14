import { Router } from '@well-known-components/http-server'
import { createTransactionMiddleware } from '../logic/transaction-middleware'
import { GlobalContext } from '../types'
import { getUserTransactions, sendTransaction } from './handlers'

export async function setupRoutes(globalContext: GlobalContext) {
  const { components } = globalContext
  const { config, server } = components

  const router = new Router()

  const apiVersion = await config.requireString('API_VERSION')

  router.prefix(`/${apiVersion}`)

  router.get('/transactions/:userAddress', getUserTransactions(components))

  router.use('/transactions', createTransactionMiddleware(components))
  router.post('/transactions', sendTransaction(components))

  server.use(router.middleware())
}
