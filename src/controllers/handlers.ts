import { ErrorCode } from 'decentraland-transactions'
import { isErrorWithMessage } from '../logic/errors'
import {
  InvalidTransactionError,
  RelayerTimeout,
} from '../types/transactions/errors'
import { SendTransactionRequest } from '../ports/transaction/types'
import { HandlerContextWithPath } from '../types'
import { HTTPResponse, StatusCode } from '../types/HTTPResponse'

export async function getUserTransactions(
  context: HandlerContextWithPath<
    'globalLogger' | 'transaction',
    '/transactions/:userAddress'
  >
): Promise<HTTPResponse> {
  const { globalLogger, transaction } = context.components

  globalLogger.info(`Returning transactions for ${context.params.userAddress}`)

  const { rows: transactions } = await transaction.getByUserAddress(
    context.params.userAddress.toLowerCase()
  )

  return {
    status: StatusCode.OK,
    body: transactions,
  }
}

export async function sendTransaction(
  context: HandlerContextWithPath<
    'globalLogger' | 'transaction',
    '/transactions'
  >
): Promise<HTTPResponse> {
  const { globalLogger, transaction } = context.components
  const id = Date.now()

  globalLogger.info(`Cloning the request for transaction ${id}`)
  const sendTransactionRequest: SendTransactionRequest = await context.request
    .clone()
    .json()
  const { transactionData } = sendTransactionRequest
  globalLogger.info(`Finish cloning the request for transaction ${id}}`)

  try {
    globalLogger.info(`Sending transaction ${JSON.stringify(transactionData)}`)
    const txHash = await transaction.sendMetaTransaction(transactionData)

    await transaction.insert({
      tx_hash: txHash,
      user_address: transactionData.from.toLowerCase(),
    })

    return {
      status: StatusCode.OK,
      body: { ok: true, txHash },
    }
  } catch (error) {
    globalLogger.error(error as Error)
    if (error instanceof InvalidTransactionError) {
      return {
        status: StatusCode.ERROR,
        body: {
          ok: false,
          message: error.message,
          code: error.code,
        },
      }
    } else if (error instanceof RelayerTimeout) {
      return {
        status: StatusCode.GATEWAY_TIMEOUT,
        body: {
          ok: false,
          message: error.message,
          code: ErrorCode.UNKNOWN,
        },
      }
    }

    return {
      status: StatusCode.ERROR,
      body: {
        ok: false,
        message: isErrorWithMessage(error) ? error.message : 'Unknown error',
        code: ErrorCode.UNKNOWN,
      },
    }
  }
}
