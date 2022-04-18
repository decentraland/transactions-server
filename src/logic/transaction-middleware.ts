import { IHttpServerComponent } from '@well-known-components/interfaces'
import {
  InvalidContractAddressError,
  InvalidSalePriceError,
  InvalidSchemaError,
  QuotaReachedError,
} from '../ports/transaction/errors'
import { AppComponents, Context } from '../types'

export function createTransactionMiddleware(
  components: Pick<
    AppComponents,
    | 'logs'
    | 'config'
    | 'transaction'
    | 'contracts'
    | 'collectionsSubgraph'
    | 'database'
  >
): IHttpServerComponent.IRequestHandler<Context<string>> {
  const { logs, transaction } = components
  const logger = logs.getLogger('transaction-wrapper')
  return async (context, next) => {
    try {
      logger.debug(
        'Checking the validity of the request before sending the transaction'
      )
      const id = Date.now()

      logger.info(`Cloning the request when validating the tx ${id}`)
      const { transactionData } = await context.request.clone().json()
      logger.info(
        `Finish cloning the request when validating the tx ${id} and data: ${transactionData}`
      )

      if (!transactionData) {
        throw new Error(
          'Missing transaction data. Please add it to the body of the request as `transactionData`'
        )
      }

      try {
        await transaction.checkData(transactionData)
      } catch (error) {
        if (error instanceof InvalidSchemaError) {
          throw Error(
            `${error.message}. Errors: ${JSON.stringify(error.schemaErrors)}`
          )
        } else if (error instanceof InvalidSalePriceError) {
          throw Error(
            `${error.message}. Sale price: ${error.salePrice} - Minimum price: ${error.minPrice}`
          )
        } else if (error instanceof InvalidContractAddressError) {
          throw Error(
            `${error.message}. Contract address: ${error.contractAddress}`
          )
        } else if (error instanceof QuotaReachedError) {
          throw Error(`${error.message}. Quota: ${error.currentQuota}`)
        }

        throw new Error(
          `The transaction data is invalid. Check the body of the request.\nError: ${
            (error as Error).message
          }`
        )
      }

      return await next()
    } catch (error) {
      logger.error(error as Error, {
        method: context.request.method,
        url: context.request.url,
      })
      return {
        status: 401,
        body: { ok: false, message: (error as Error).message },
      }
    }
  }
}
