import { IHttpServerComponent } from '@well-known-components/interfaces'
import { AppComponents } from '../types'

export function handleThings<T>(
  components: Pick<AppComponents, 'logs'>
): IHttpServerComponent.IRequestHandler<T> {
  const { logs } = components
  const logger = logs.getLogger('transactions-server')

  return async (context) => {
    logger.info('Something happened')
    return {
      status: 200,
      body: context.query,
    }
  }
}
