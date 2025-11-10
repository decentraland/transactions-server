import { Router } from '@well-known-components/http-server'
import { createTransactionMiddleware } from '../logic/transaction-middleware'
import { GlobalContext } from '../types'
import {
  getUserTransactions,
  sendTransaction,
  contractsAddress,
} from './handlers'

// We return the entire router because it will be easier to test than a whole server
export async function setupRoutes(globalContext: GlobalContext) {
  const { components } = globalContext
  const { config } = components

  const router = new Router<GlobalContext>()

  const apiVersion = await config.requireString('API_VERSION')

  router.prefix(`/${apiVersion}`)

  router.get('/transactions/:userAddress', getUserTransactions)
  router.use('/transactions', createTransactionMiddleware(components))
  router.post('/transactions', sendTransaction)
  router.get('/contracts/:address', contractsAddress)

  return router
}
