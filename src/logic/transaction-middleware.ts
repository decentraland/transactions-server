import { IHttpServerComponent } from '@well-known-components/interfaces'
import {
  HighCongestionError,
  InvalidContractAddressError,
  InvalidSalePriceError,
  InvalidSchemaError,
  InvalidTransactionError,
  QuotaReachedError,
  SimulateTransactionError,
} from '../types/transactions/errors'
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
    let from = 'unknown'

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
        logger.warn('Transaction rejected due to missing transaction data')
        return {
          status: StatusCode.BAD_REQUEST,
          body: {
            ok: false,
            message:
              'Missing transaction data. Please add it to the body of the request as `transactionData`',
          },
        }
      }

      from = transactionData.from

      await transaction.checkData(transactionData)

      return await next()
    } catch (error) {

      if (error instanceof HighCongestionError) {
        logger.warn('Transaction rejected due to high network congestion', {
          from,

          currentGasPrice: error.currentGasPrice,
          maxGasPriceAllowed: error.maxGasPriceAllowed,
        })
        return {
          status: StatusCode.SERVICE_UNAVAILABLE,
          body: {
            ok: false,
            message: error.message,
            code: error.code,
          },
        }
      }

      if (error instanceof QuotaReachedError) {
        logger.warn('Transaction rejected due to quota reached', {
          from,

          currentQuota: error.currentQuota.toString(),
        })
        return {
          status: StatusCode.TOO_MANY_REQUESTS,
          body: {
            ok: false,
            message: error.message,
            code: error.code,
          },
        }
      }

      if (error instanceof InvalidSchemaError) {
        logger.warn('Transaction rejected due to invalid schema', {
          from,

          schemaErrors: JSON.stringify(error.schemaErrors),
        })
        return {
          status: StatusCode.BAD_REQUEST,
          body: {
            ok: false,
            message: error.message,
            code: error.code,
          },
        }
      }

      if (error instanceof InvalidSalePriceError) {
        logger.warn('Transaction rejected due to sale price too low', {
          from,

          minPrice: error.minPrice,
          salePrice: error.salePrice,
        })
        return {
          status: StatusCode.BAD_REQUEST,
          body: {
            ok: false,
            message: error.message,
            code: error.code,
          },
        }
      }

      if (error instanceof InvalidContractAddressError) {
        logger.warn('Transaction rejected due to invalid contract address', {
          from,

          contractAddress: error.contractAddress,
        })
        return {
          status: StatusCode.BAD_REQUEST,
          body: {
            ok: false,
            message: error.message,
            code: error.code,
          },
        }
      }

      if (
        error instanceof InvalidTransactionError ||
        error instanceof SimulateTransactionError
      ) {
        logger.warn('Transaction rejected due to invalid transaction data', {
          from,

          message: error.message,
        })
        return {
          status: StatusCode.BAD_REQUEST,
          body: {
            ok: false,
            message: error.message,
            code: error.code,
          },
        }
      }

      logger.error('Unexpected error during transaction validation', {
        from,
        message: (error as Error).message,
        stack: (error as Error).stack ?? '',
      })
      return {
        status: StatusCode.ERROR,
        body: {
          ok: false,
          message: (error as Error).message,
          code: (error as InvalidTransactionError).code,
        },
      }
    }
  }
}
