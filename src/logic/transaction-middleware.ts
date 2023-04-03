import { IHttpServerComponent } from '@well-known-components/interfaces'
import {
  HighCongestionError,
  InvalidTransactionError,
} from '../ports/transaction/errors'
import { AppComponents, Context } from '../types'
import { HTTPResponse, StatusCode } from '../types/HTTPResponse'

export function createTransactionMiddleware(
  components: Pick<AppComponents, 'logs' | 'transaction'>
): IHttpServerComponent.IRequestHandler<Context<string>> {
  const { logs, transaction } = components
  const logger = logs.getLogger('transaction-wrapper')
  return async (
    context,
    next
  ): Promise<IHttpServerComponent.IResponse | HTTPResponse> => {
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

      await transaction.checkData(transactionData)

      return await next()
    } catch (error) {
      logger.error(error as Error, {
        method: context.request.method,
        url: context.request.url,
      })

      if (error instanceof HighCongestionError) {
        return {
          status: StatusCode.SERVICE_UNAVAILABLE,
          body: {
            ok: false,
            message: error.message,
            code: error.code,
          },
        }
      }

      return {
        status: StatusCode.UNAUTHORIZED,
        body: {
          ok: false,
          message: (error as Error).message,
          code: (error as InvalidTransactionError).code,
        },
      }
    }
  }
}
