import { IHttpServerComponent } from '@well-known-components/interfaces'
import { TransactionData } from '../ports/transaction/types'
import { Schema } from '../ports/validation/types'
import { AppComponents, Context } from '../types'

export function createTransactionMiddleware(
  components: Pick<AppComponents, 'logs' | 'validation' | 'transaction'>
): IHttpServerComponent.IRequestHandler<Context<string>> {
  const { logs, validation, transaction } = components
  const logger = logs.getLogger('transaction-wrapper')

  const transactionSchema: Schema<TransactionData> = {
    type: 'object',
    properties: {
      from: { type: 'string' },
      to: { type: 'string' },
      params: { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: false,
    required: ['from', 'to', 'params'],
  }

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
        validation.require(transactionSchema, transactionData)
        await transaction.checkTransactionData(transactionData)
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
