import { createPublicClient, http } from 'viem'
import { ErrorCode } from 'decentraland-transactions'
import { AppComponents } from '../../types'
import { sleep } from '../../logic/time'
import {
  TransactionData,
  InvalidTransactionError,
  RelayerError,
  RelayerTimeout,
} from '../../types/transactions'
import { OpenZeppelinMetaTransactionComponent } from './types'

// All OZ Relayer responses are wrapped in { success, data, error }
type OZResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
}

type OZTransactionData = {
  id: string
  hash: string | null
  status: string
  status_reason: string | null
  confirmed_at?: string | null
}

// Terminal transaction statuses that indicate the tx will never get a hash
const FAILED_STATUSES = new Set(['failed', 'invalid', 'cancelled'])

const HASH_POLL_MAX_ATTEMPTS = 30
const HASH_POLL_INTERVAL_MS = 2000

const BALANCE_KEYWORDS = [
  'insufficient',
  'balance',
  'funds',
  'no available token',
]
const REVERT_KEYWORDS = ['revert', 'reverted', 'execution reverted']

function containsAny(
  text: string | null | undefined,
  keywords: string[]
): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error'

const isRetryThresholdExceeded = (
  seenHashes: Set<string>,
  maxRetries: number
): boolean => seenHashes.size - 1 > maxRetries

export async function createOpenZeppelinComponent(
  components: Pick<AppComponents, 'config' | 'logs' | 'metrics' | 'fetcher'>
): Promise<OpenZeppelinMetaTransactionComponent> {
  const { config, logs, metrics, fetcher } = components
  const logger = logs.getLogger('openzeppelin')

  const relayerURL = await config.requireString('OZ_RELAYER_URL')
  const apiKey = await config.requireString('OZ_RELAYER_API_KEY')
  const relayerId = await config.requireString('OZ_RELAYER_ID')
  const speed = (await config.getString('OZ_RELAYER_SPEED')) || 'fast'
  const rpcURL = await config.getString('RPC_URL')

  const retryTrackIntervalMs =
    (await config.getNumber('OZ_RETRY_TRACK_INTERVAL_MS')) ?? 5 * 1000
  const retryTrackMaxDurationMs =
    (await config.getNumber('OZ_RETRY_TRACK_MAX_DURATION_MS')) ?? 2 * 60 * 1000
  const maxRetries = (await config.getNumber('OZ_MAX_RETRIES')) ?? 20

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  // Shared polling loop for the OZ tx detail endpoint. Yields each parsed
  // transaction so the caller drives its own exit conditions via plain
  // return / throw — no callback ceremony.
  async function* pollTransactionDetail(
    txId: string,
    options: {
      maxAttempts: number
      intervalMs: number
      onError: (attempt: number, error: unknown) => void
    }
  ): AsyncGenerator<{ transaction: OZTransactionData; attempt: number }> {
    const url = `${relayerURL}/api/v1/relayers/${relayerId}/transactions/${txId}`

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      await sleep(options.intervalMs)

      let response: any
      try {
        response = await fetcher.fetch(url, { headers: authHeaders })
      } catch (error: unknown) {
        options.onError(attempt, error)
        continue
      }

      if (!response.ok) continue

      const { data } = (await response.json()) as OZResponse<OZTransactionData>
      if (!data) continue

      yield { transaction: data, attempt }
    }
  }

  async function pollForHash(txId: string): Promise<string> {
    for await (const { transaction } of pollTransactionDetail(txId, {
      maxAttempts: HASH_POLL_MAX_ATTEMPTS,
      intervalMs: HASH_POLL_INTERVAL_MS,
      onError: (attempt, error) =>
        logger.error(
          `OpenZeppelin poll attempt ${attempt} failed: ${getErrorMessage(
            error
          )}`
        ),
    })) {
      if (FAILED_STATUSES.has(transaction.status)) {
        const reason = transaction.status_reason || transaction.status
        logger.error(`OpenZeppelin transaction ${txId} failed: ${reason}`)

        if (transaction.status === 'cancelled') {
          metrics.increment('dcl_error_cancelled_transactions_openzeppelin')
          if (containsAny(transaction.status_reason, BALANCE_KEYWORDS)) {
            metrics.increment('dcl_error_no_balance_transactions_openzeppelin')
          }
        } else if (containsAny(transaction.status_reason, REVERT_KEYWORDS)) {
          metrics.increment('dcl_error_reverted_transactions_openzeppelin')
        } else if (containsAny(transaction.status_reason, BALANCE_KEYWORDS)) {
          metrics.increment('dcl_error_no_balance_transactions_openzeppelin')
        } else {
          metrics.increment('dcl_error_service_errors_openzeppelin')
        }

        throw new InvalidTransactionError(
          `Transaction ${transaction.status}: ${reason}`,
          ErrorCode.EXPECTATION_FAILED
        )
      }

      if (transaction.hash) {
        return transaction.hash
      }
    }

    metrics.increment('dcl_error_timeout_openzeppelin')
    throw new RelayerTimeout('The limit of status checks was reached')
  }

  // Polls OZ to count transaction replacements.
  // Every replacement generates a new hash for the same tx.id.
  // Retry count = distinct hashes - 1.
  // Read-only: never cancels or replaces transactions.
  const trackTransactionRetries = async (
    txId: string,
    firstHash: string
  ): Promise<void> => {
    if (retryTrackIntervalMs <= 0 || retryTrackMaxDurationMs <= 0) {
      logger.warn(
        'OpenZeppelin retry tracker disabled due to invalid timing config'
      )
      return
    }

    const seenHashes = new Set<string>([firstHash])

    for await (const { transaction } of pollTransactionDetail(txId, {
      maxAttempts: Math.ceil(retryTrackMaxDurationMs / retryTrackIntervalMs),
      intervalMs: retryTrackIntervalMs,
      onError: (attempt, error) =>
        logger.warn(
          `OpenZeppelin retry poll ${attempt} for ${txId} failed: ${getErrorMessage(
            error
          )}`
        ),
    })) {
      if (transaction.hash) {
        seenHashes.add(transaction.hash)

        if (isRetryThresholdExceeded(seenHashes, maxRetries)) {
          logger.error(
            `OpenZeppelin transaction ${txId} exceeded ${maxRetries} retries`
          )
          metrics.increment('dcl_error_transaction_high_retries_openzeppelin')
          return
        }
      }

      if (FAILED_STATUSES.has(transaction.status) || transaction.confirmed_at) {
        return
      }
    }
  }

  async function sendMetaTransaction(
    transactionData: TransactionData
  ): Promise<string> {
    const to = transactionData.params[0]
    const data = transactionData.params[1]

    let response: any
    try {
      response = await fetcher.fetch(
        `${relayerURL}/api/v1/relayers/${relayerId}/transactions`,
        {
          method: 'POST',
          headers: authHeaders,
          // value is required by the OZ Relayer API; meta-transactions send 0 ETH
          body: JSON.stringify({ to, data, speed, value: '0x0' }),
        }
      )
    } catch (error: unknown) {
      const message = getErrorMessage(error)
      logger.error(`OpenZeppelin failed to relay the transaction: ${message}`)
      metrics.increment('dcl_error_service_errors_openzeppelin')
      throw new RelayerError(500, message)
    }

    if (!response.ok) {
      const body = await response.text()
      logger.error(
        `OpenZeppelin relayer responded with ${response.status}: ${body}`
      )
      metrics.increment('dcl_error_service_errors_openzeppelin')
      if (containsAny(body, BALANCE_KEYWORDS)) {
        metrics.increment('dcl_error_no_balance_transactions_openzeppelin')
      }

      if (response.status === 422 || response.status === 400) {
        throw new InvalidTransactionError(body, ErrorCode.EXPECTATION_FAILED)
      }
      throw new RelayerError(response.status, body)
    }

    const {
      success,
      data: txData,
      error,
    } = (await response.json()) as OZResponse<OZTransactionData>

    if (!success || !txData) {
      metrics.increment('dcl_error_service_errors_openzeppelin')
      if (containsAny(error, BALANCE_KEYWORDS)) {
        metrics.increment('dcl_error_no_balance_transactions_openzeppelin')
      }
      throw new RelayerError(
        500,
        error || 'Unexpected response from OZ Relayer'
      )
    }

    // hash may be null initially — poll until the relayer signs and submits it
    const hash = txData.hash ?? (await pollForHash(txData.id))

    metrics.increment('dcl_sent_transactions_openzeppelin')
    logger.info(
      `OpenZeppelin relayed transaction ${txData.id} with hash ${hash}`
    )

    trackTransactionRetries(txData.id, hash).catch((error: unknown) => {
      logger.warn(
        `OpenZeppelin retry tracker for ${txData.id} crashed: ${getErrorMessage(
          error
        )}`
      )
    })

    return hash
  }

  const getNetworkGasPrice = async (): Promise<bigint | null> => {
    if (!rpcURL) {
      return null
    }
    try {
      const client = createPublicClient({ transport: http(rpcURL) })
      return await client.getGasPrice()
    } catch (error) {
      logger.error('OpenZeppelin failed to get the network gas price')
      return null
    }
  }

  return {
    getNetworkGasPrice,
    sendMetaTransaction,
  }
}
