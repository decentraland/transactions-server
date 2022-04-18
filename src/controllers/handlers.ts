import { MetaTransactionError } from '../ports/transaction/errors'
import { SendTransactionRequest } from '../ports/transaction/types'
import { HandlerContextWithPath } from '../types'

export async function getUserTransactions(
  context: HandlerContextWithPath<
    'globalLogger' | 'transaction',
    '/transactions/:userAddress'
  >
) {
  const { globalLogger, transaction } = context.components

  globalLogger.info(`Returning transactions for ${context.params.userAddress}`)

  const { rows: transactions } = await transaction.getByUserAddress(
    context.params.userAddress
  )

  return {
    status: 200,
    body: transactions,
  }
}

export async function sendTransaction(
  context: HandlerContextWithPath<
    'globalLogger' | 'transaction',
    '/transactions'
  >
) {
  const { globalLogger, transaction } = context.components
  const id = Date.now()

  globalLogger.info(`Cloning the request for transaction ${id}`)
  const sendTransactionRequest: SendTransactionRequest = await context.request
    .clone()
    .json()
  const { transactionData } = sendTransactionRequest
  globalLogger.info(
    `Finish cloning the request for transaction ${id} and data ${transactionData}`
  )

  try {
    globalLogger.info(`Sending transaction ${JSON.stringify(transactionData)}`)
    const txHash = await transaction.sendMetaTransaction(transactionData)

    await transaction.insertTransaction({
      txHash,
      userAddress: transactionData.from,
    })

    return {
      status: 200,
      body: { ok: true, txHash },
    }
  } catch (error) {
    globalLogger.error(error as Error)
    return {
      status: 500,
      body: {
        ok: false,
        message: (error as Error).message,
        code: (error as MetaTransactionError).code,
      },
    }
  }
}
