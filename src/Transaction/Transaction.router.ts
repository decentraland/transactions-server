import { env } from 'decentraland-commons'
import { server } from 'decentraland-server'
import { Request } from 'express'
import Ajv from 'ajv'
import 'isomorphic-fetch'


import { Router } from '../common/Router'
import { HTTPError } from '../common/HTTPError'
import { TransactionAttributes, transactionSchema } from './Transaction.types'

const ajv = new Ajv()

const BICONOMY_API_KEY = env.get('BICONOMY_API_KEY', '')
const BICONOMY_API_ID = env.get('BICONOMY_API_ID', '')


export class TransactionRouter extends Router {
  mount() {
    /**
     * Returns the manifest of a project
     */
    this.router.post(
      '/transactions',
      server.handleRequest(this.relayTransaction)
    )

    /**
     * Returns the manifest of a pool
     */
    this.router.get(
      '/transactions/:user_address',
      server.handleRequest(this.getTransactionsByUserAddress)
    )

  }

  async relayTransaction(req: Request) {
    const transactionJSON: TransactionAttributes = server.extractFromReq(req, 'transaction')
    const validator = ajv.compile(transactionSchema)
    validator(transactionJSON)

    if (validator.errors) {
      throw new HTTPError('Invalid schema', validator.errors)
    }

    const transaction: TransactionAttributes = transactionJSON

    const result = await fetch(
      "https://api.biconomy.io/api/v2/meta-tx/native",
      {
        headers: {
          'x-api-key': BICONOMY_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          apiId: BICONOMY_API_ID,
          ...transaction
        }),
        method: "POST",
      }
    )
    const jsonRes = await result.json()

    return jsonRes
  }

  async getTransactionsByUserAddress(_: Request) {
    // Not implemented
  }
}
