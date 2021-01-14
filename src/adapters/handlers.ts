import { IHttpServerComponent } from '@well-known-components/interfaces'
import { TransactionData } from '../ports/transaction/types'
import { AppComponents, Context } from '../types'

type SendTransactionRequest = {
  transactionData: TransactionData
}

export function getUserTransactions(
  components: Pick<AppComponents, 'logs' | 'transaction'>
): IHttpServerComponent.IRequestHandler<
  Context<'/transactions/:user_address'>
> {
  const { logs, transaction } = components
  const logger = logs.getLogger('transactions-server')

  return async (context) => {
    logger.info(`Returning transactions for ${context.params.user_address}`)
    const { rows: transactions } = await transaction.getByUserAddress(
      context.params.user_address
    )
    return {
      status: 200,
      body: transactions,
    }
  }
}

export function sendTransaction(
  components: Pick<AppComponents, 'logs' | 'transaction'>
): IHttpServerComponent.IRequestHandler<Context<'/transactions'>> {
  const { logs, transaction } = components
  const logger = logs.getLogger('transactions-server')

  return async (context) => {
    const sendTransactionRequest: SendTransactionRequest = await context.request
      .clone()
      .json()
    const { transactionData } = sendTransactionRequest

    try {
      logger.info(`Sending transaction for ${transactionData.userAddress}`)
      const { txHash } = await transaction.sendMetaTransaction(transactionData)

      return {
        status: 200,
        body: { txHash },
      }
    } catch (error) {
      logger.info(
        `Error sending a transaction for ${transactionData.userAddress}`,
        error.message
      )
      return {
        status: 500,
        body: { ok: false, message: error.message },
      }
    }
  }
}
