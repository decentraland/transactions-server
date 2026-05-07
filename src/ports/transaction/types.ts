import { IDatabase } from '@well-known-components/interfaces'
import { Schema } from '../../types/validation'
import { TransactionData } from '../../types/transactions/transactions'

export interface ITransactionComponent {
  /**
   * Forwards the meta-transaction to the configured upstream relayer and
   * resolves with the broadcast tx hash.
   * @param transactionData - The validated meta-transaction payload.
   * @returns The on-chain transaction hash.
   */
  sendMetaTransaction(transactionData: TransactionData): Promise<string>

  /**
   * Atomically debits one daily-quota slot for `userAddress` and stamps the
   * row with `sessionId`. Throws QuotaReachedError if the user is at the
   * configured per-day limit.
   * @param userAddress - The user's lower-cased EVM address.
   * @param sessionId - A request-unique identifier used to address this
   * specific reservation in confirmReservation / releaseReservation.
   * @throws QuotaReachedError
   */
  reserveQuota(userAddress: string, sessionId: string): Promise<void>

  /**
   * Promotes the reservation row identified by `sessionId` to a confirmed
   * row carrying `txHash`. Called after a successful broadcast.
   * @param sessionId - The identifier returned to the caller of reserveQuota.
   * @param txHash - The on-chain transaction hash returned by the relayer.
   */
  confirmReservation(sessionId: string, txHash: string): Promise<void>

  /**
   * Deletes the reservation row identified by `sessionId`. Called when the
   * upstream relayer rejected the request before broadcasting.
   * @param sessionId - The identifier returned to the caller of reserveQuota.
   */
  releaseReservation(sessionId: string): Promise<void>

  /**
   * Returns the user's confirmed transactions, excluding any internal
   * reservation rows.
   * @param userAddress - The user's lower-cased EVM address.
   */
  getByUserAddress(
    userAddress: string
  ): Promise<IDatabase.IQueryResult<TransactionRow>>

  /**
   * Runs the validation pipeline on `transactionData`. Throws a typed
   * domain error on the first validation that fails.
   * @param transactionData - The meta-transaction payload to validate.
   * @throws InvalidSchemaError | InvalidFunctionSelectorError |
   * InvalidContractAddressError | HighCongestionError |
   * SimulateTransactionError | InvalidSalePriceError
   */
  checkData(transactionData: TransactionData): Promise<void>
}

export type SendTransactionRequest = {
  transactionData: TransactionData
}

export type TransactionRow = {
  id: number
  tx_hash: string
  user_address: string
  created_at: Date
}

export const transactionSchema: Schema<TransactionData> = {
  type: 'object',
  properties: {
    from: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    params: {
      type: 'array',
      items: [
        { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
        // 100 KB calldata cap (200_000 hex chars + "0x"); well above any legit
        // DCL meta-tx and short-circuits oversized payloads before the RPC
        // round-trip in checkTransaction's eth_estimateGas.
        { type: 'string', pattern: '^0x[a-fA-F0-9]+$', maxLength: 200002 },
      ],
      additionalItems: false,
      minItems: 2,
      maxItems: 2,
    },
  },
  additionalProperties: false,
  required: ['from', 'params'],
}
