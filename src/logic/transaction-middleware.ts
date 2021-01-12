import { IHttpServerComponent } from '@well-known-components/interfaces'
import { AppComponents, Context } from '../types'

export function createTransactionMiddleware(
  components: Pick<AppComponents, 'logs'>
): IHttpServerComponent.IRequestHandler<Context<string>> {
  const { logs } = components
  const logger = logs.getLogger('transaction-wrapper')

  return async (ctx, next) => {
    try {
      // TODO: Constraint checks go here
      logger.debug('HOLA, soy el middleware')
      return await next()
    } catch (error) {
      logger.error(error, {
        method: ctx.request.method,
        url: ctx.request.url,
      })
      return {
        status: 401,
        body: { ok: false },
      }
    }
  }
}
