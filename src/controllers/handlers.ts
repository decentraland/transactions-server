import { randomUUID } from 'crypto'
import { ErrorCode } from 'decentraland-transactions'
import { isErrorWithMessage } from '../logic/errors'
import { extractMetaTxUserAddress } from '../ports/transaction/validation/extractMetaTxUserAddress'
import {
  BroadcastFailedError,
  InvalidTransactionError,
  QuotaReachedError,
  RelayerError,
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

  const userAddress = extractMetaTxUserAddress(transactionData.params[1])
  const sessionId = randomUUID()
  let reserved = false

  try {
    await transaction.reserveQuota(userAddress, sessionId)
    reserved = true

    globalLogger.info(`Sending transaction ${JSON.stringify(transactionData)}`)
    const txHash = await transaction.sendMetaTransaction(transactionData)

    await transaction.confirmReservation(sessionId, txHash)

    return {
      status: StatusCode.OK,
      body: { ok: true, txHash },
    }
  } catch (error) {
    globalLogger.error('Failed to send transaction', {
      transactionId: id,
      userAddress,
      sessionId,
      error: isErrorWithMessage(error) ? error.message : 'Unknown error',
    })

    // Reservation lifecycle:
    //  - QuotaReachedError: thrown by reserveQuota itself → no row exists,
    //    nothing to release.
    //  - InvalidTransactionError / RelayerError: pre-broadcast failure, the
    //    upstream relayer never broadcast → release the slot.
    //  - BroadcastFailedError / RelayerTimeout: post-broadcast or
    //    indeterminate → keep the slot consumed.
    // BroadcastFailedError extends InvalidTransactionError, so the
    // BroadcastFailedError check must come first.
    const isPostBroadcast =
      error instanceof BroadcastFailedError || error instanceof RelayerTimeout
    const isPreBroadcast =
      !isPostBroadcast &&
      (error instanceof InvalidTransactionError || error instanceof RelayerError)

    if (reserved && isPreBroadcast) {
      try {
        await transaction.releaseReservation(sessionId)
      } catch (releaseError) {
        globalLogger.error('Failed to release reservation', {
          transactionId: id,
          userAddress,
          sessionId,
          error: isErrorWithMessage(releaseError)
            ? releaseError.message
            : 'Unknown error',
        })
      }
    }

    if (error instanceof QuotaReachedError) {
      return {
        status: StatusCode.TOO_MANY_REQUESTS,
        body: {
          ok: false,
          message: error.message,
          code: error.code,
        },
      }
    }

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

export async function contractsAddress(
  context: HandlerContextWithPath<
    'globalLogger' | 'contracts',
    '/contracts/:address'
  >
): Promise<HTTPResponse> {
  const { globalLogger, contracts } = context.components
  const address = context.params.address.toLowerCase()

  globalLogger.info(`Validating address ${address}`)

  try {
    // isValidAddress already checks isCollectionAddress and isWhitelisted internally
    const isValid = await contracts.isValidAddress(address)

    if (isValid) {
      return {
        status: StatusCode.OK,
        body: { ok: true },
      }
    } else {
      return {
        status: StatusCode.NOT_FOUND,
        body: {
          ok: false,
          message: 'Address is not valid',
          code: ErrorCode.UNKNOWN,
        },
      }
    }
  } catch (error) {
    globalLogger.error(error as Error)
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
