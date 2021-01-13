import { IHttpServerComponent } from '@well-known-components/interfaces'
import { TransactionData } from '../ports/transaction/types'
import { Schema } from '../ports/validation/types'
import { AppComponents, Context } from '../types'

export function createTransactionMiddleware(
  components: Pick<AppComponents, 'logs' | 'validation'>
): IHttpServerComponent.IRequestHandler<Context<string>> {
  const { logs, validation } = components
  const logger = logs.getLogger('transaction-wrapper')

  const transactionSchema: Schema<TransactionData> = {
    type: 'object',
    properties: {
      userAddress: { type: 'string' },
      to: { type: 'string' },
      params: { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: false,
    removeAdditional: true,
    required: ['userAddress', 'params'],
  }

  return async (context, next) => {
    try {
      logger.debug(
        'Checking the validity of the request before sending the transaction'
      )
      const { transaction } = await context.request.json()

      if (!validation.validate(transactionSchema, transaction)) {
        throw new Error(
          `The requested transaction params are invalid. Check the body of the request`
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
        body: { ok: false },
      }
    }
  }
}
