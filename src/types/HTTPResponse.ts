import { ErrorCode } from '../ports/transaction/errors'
import { MetaTransactionCode, TransactionRow } from '../ports/transaction/types'

export enum StatusCode {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  LOCKED = 423,
  CONFLICT = 409,
  ERROR = 500,
}

export type HTTPResponse = {
  status: StatusCode
  body:
    | {
        ok: false
        message: string
        code: ErrorCode
        transactionErrorCode?: MetaTransactionCode
      }
    | {
        ok: true
        txHash: string
      }
    | TransactionRow[]
}
