import { ErrorCode } from 'decentraland-transactions'
import { TransactionRow } from '../ports/transaction/types'

export enum StatusCode {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  LOCKED = 423,
  CONFLICT = 409,
  ERROR = 500,
  GATEWAY_TIMEOUT = 504,
  SERVICE_UNAVAILABLE = 503,
}

type TransactionsResponseBody = TransactionRow[]
type TxHashResponseBody = {
  ok: true
  txHash: string
}
type ValidationResponseBody = {
  ok: true
}
type ErrorResponseBody = {
  ok: false
  message: string
  code: ErrorCode
}

export type HTTPResponse = {
  status: StatusCode
  body:
    | TxHashResponseBody
    | TransactionsResponseBody
    | ErrorResponseBody
    | ValidationResponseBody
}
