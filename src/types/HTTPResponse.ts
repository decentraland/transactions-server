import type { ErrorCode } from 'decentraland-transactions'
import type { TransactionRow } from '../ports/transaction/types'

export enum StatusCode {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  TOO_MANY_REQUESTS = 429,
  LOCKED = 423,
  CONFLICT = 409,
  ERROR = 500,
  GATEWAY_TIMEOUT = 504,
  SERVICE_UNAVAILABLE = 503,
}

type TransactionsResponseBody = TransactionRow[]
interface TxHashResponseBody {
  ok: true
  txHash: string
}
interface ValidationResponseBody {
  ok: true
}
interface ErrorResponseBody {
  ok: false
  message: string
  code: ErrorCode
}

export interface HTTPResponse {
  status: StatusCode
  body:
    | TxHashResponseBody
    | TransactionsResponseBody
    | ErrorResponseBody
    | ValidationResponseBody
}
