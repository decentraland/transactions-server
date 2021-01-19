import { IHttpServerComponent } from '@well-known-components/interfaces'
import { AppComponents, Context } from '../types'
import { ensureTransactionData, validateTrasactionSchema } from './transaction'

export function createTransactionMiddleware(
  components: Pick<AppComponents, 'logs' | 'config' | 'database'>
): IHttpServerComponent.IRequestHandler<Context<string>> {
  const { logs, config, database } = components
  const logger = logs.getLogger('transaction-wrapper')

  return async (context, next) => {
    try {
      logger.debug(
        'Checking the validity of the request before sending the transaction'
      )
      const { transactionData } = await context.request.clone().json()

      if (!transactionData) {
        throw new Error(
          'Missing transaction data. Please add it to the body of the request as `transactionData`'
        )
      }

      try {
        if (!validateTrasactionSchema(transactionData)) {
          throw new Error(
            `Invalid transaction data: ${JSON.stringify(
              validateTrasactionSchema.errors
            )}`
          )
        }
        await ensureTransactionData({ config, database }, transactionData)
      } catch (error) {
        throw new Error(
          `The transaction data is invalid. Check the body of the request.\nError: ${error.message}`
        )
      }

      return await next()
    } catch (error) {
      logger.error(error, {
        method: context.request.method,
        url: context.request.url,
      })
      return {
        status: 401,
        body: { ok: false, message: error.message },
      }
    }
  }
}
