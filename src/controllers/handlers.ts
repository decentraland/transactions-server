import {
  getByUserAddress,
  insertTransaction,
  MetaTransactionError,
  sendMetaTransaction,
} from '../logic/transaction'
import { SendTransactionRequest } from '../types/transaction'
import { HandlerContextWithPath } from '../types'

export async function getUserTransactions(
  context: HandlerContextWithPath<
    'globalLogger' | 'database',
    '/transactions/:userAddress'
  >
) {
  const { globalLogger, database } = context.components

  globalLogger.info(`Returning transactions for ${context.params.userAddress}`)

  const { rows: transactions } = await getByUserAddress(
    { database },
    context.params.userAddress
  )

  return {
    status: 200,
    body: transactions,
  }
}

export async function sendTransaction(
  context: HandlerContextWithPath<
    'globalLogger' | 'config' | 'database' | 'fetcher' | 'metrics',
    '/transactions'
  >
) {
  const { globalLogger, database } = context.components

  const sendTransactionRequest: SendTransactionRequest = await context.request
    .clone()
    .json()
  const { transactionData } = sendTransactionRequest

  try {
    globalLogger.info(`Sending transaction ${JSON.stringify(transactionData)}`)
    const txHash = await sendMetaTransaction(
      context.components,
      transactionData
    )

    await insertTransaction(
      { database },
      { txHash, userAddress: transactionData.from }
    )

    return {
      status: 200,
      body: { txHash },
    }
  } catch (error) {
    globalLogger.error(error)
    return {
      status: 500,
      body: {
        ok: false,
        message: error.message,
        code: (error as MetaTransactionError).code,
      },
    }
  }
}
