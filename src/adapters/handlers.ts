import { IHttpServerComponent } from '@well-known-components/interfaces'
import {
  getByUserAddress,
  insertTransaction,
  sendMetaTransaction,
} from '../logic/transaction'
import { SendTransactionRequest } from '../types/transaction'
import { AppComponents, Context } from '../types'

export function getUserTransactions(
  components: Pick<AppComponents, 'logs' | 'database'>
): IHttpServerComponent.IRequestHandler<Context<'/transactions/:userAddress'>> {
  const { logs, database } = components
  const logger = logs.getLogger('transactions-server')

  return async (context) => {
    logger.info(`Returning transactions for ${context.params.userAddress}`)
    const { rows: transactions } = await getByUserAddress(
      { database },
      context.params.userAddress
    )

    return {
      status: 200,
      body: transactions,
    }
  }
}

export function sendTransaction(
  components: Pick<AppComponents, 'logs' | 'config' | 'database'>
): IHttpServerComponent.IRequestHandler<Context<'/transactions'>> {
  const { logs, config, database } = components
  const logger = logs.getLogger('transactions-server')

  return async (context) => {
    const sendTransactionRequest: SendTransactionRequest = await context.request
      .clone()
      .json()
    const { transactionData } = sendTransactionRequest

    try {
      logger.info(`Sending transaction for ${transactionData.from}`)
      const txHash = await sendMetaTransaction({ config }, transactionData)

      await insertTransaction(
        { database },
        { txHash, userAddress: transactionData.from }
      )

      return {
        status: 200,
        body: { txHash },
      }
    } catch (error) {
      logger.info(
        `Error sending a transaction for ${transactionData.from}`,
        error.message
      )
      return {
        status: 500,
        body: { ok: false, message: error.message },
      }
    }
  }
}
