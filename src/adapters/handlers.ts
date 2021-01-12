import { IHttpServerComponent } from '@well-known-components/interfaces'
import { Transaction } from '../ports/transaction/types'
import { AppComponents, Context } from '../types'

type SendTransactionRequest = {
  transaction: Transaction
}

export function getUserTransactions(
  components: Pick<AppComponents, 'logs'>
): IHttpServerComponent.IRequestHandler<
  Context<'/transactions/:user_address'>
> {
  const { logs } = components
  const logger = logs.getLogger('transactions-server')

  return async (context) => {
    logger.info(`Returning transactions for ${context.params.user_address}`)
    return {
      status: 200,
      body: 'OK',
    }
  }
}

export function sendTransaction(
  components: Pick<AppComponents, 'logs'>
): IHttpServerComponent.IRequestHandler<Context<'/transactions'>> {
  const { logs } = components
  const logger = logs.getLogger('transactions-server')

  return async (context) => {
    const { transaction }: SendTransactionRequest = await context.request.json()

    logger.info(`Sending transaction for ${transaction.userAddress}`)
    return {
      status: 200,
      body: { ok: true },
    }
  }
}
