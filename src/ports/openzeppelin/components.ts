import { createPublicClient, http } from 'viem'
import { IFetchComponent } from '@well-known-components/http-server'
import { ErrorCode } from 'decentraland-transactions'
import { AppComponents } from '../../types'
import { sleep } from '../../logic/time'
import {
  TransactionData,
  BroadcastFailedError,
  InvalidTransactionError,
  RelayerError,
  RelayerTimeout,
} from '../../types/transactions'
import { ProviderName } from '../relay-router/types'
import { OpenZeppelinMetaTransactionComponent } from './types'

// All OZ Relayer responses are wrapped in { success, data, error }
type OZResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
}

// OpenZeppelin Relayer transaction status enum.
// See https://docs.openzeppelin.com/relayer/1.4.x/api/getTransactionById
export enum OZTransactionStatus {
  Pending = 'pending',
  Sent = 'sent',
  Submitted = 'submitted',
  Mined = 'mined',
  Confirmed = 'confirmed',
  Canceled = 'canceled',
  Failed = 'failed',
  Expired = 'expired',
}

type OZTransactionData = {
  id: string
  hash: string | null
  status: string
  status_reason: string | null
}

// Statuses that indicate the relayer has actually broadcast the tx to the
// network. 'sent' is intentionally excluded: in the OZ Relayer state machine,
// 'sent' means "a Submit job was started" — the RPC may still reject it (e.g.
// insufficient funds), in which case the relayer keeps the tx parked in
// 'sent' while retrying. Returning a hash from a 'sent' tx hands the caller a
// hash that may never land on-chain.
const BROADCAST_STATUSES: ReadonlySet<string> = new Set([
  OZTransactionStatus.Submitted,
  OZTransactionStatus.Mined,
  OZTransactionStatus.Confirmed,
])
// Terminal failure statuses from the OZ Relayer transaction status enum.
const FAILED_STATUSES: ReadonlySet<string> = new Set([
  OZTransactionStatus.Canceled,
  OZTransactionStatus.Failed,
  OZTransactionStatus.Expired,
])

type OZRelayerInfo = {
  address: string
}

const RELAYERS_FETCH_TIMEOUT_MS = 5_000
const DEFAULT_RELAYERS_FETCH_INTERVAL_MS = 60 * 60 * 1000

const DEFAULT_MAX_STATUS_CHECKS = 150
const DEFAULT_SLEEP_TIME_BETWEEN_CHECKS_MS = 800
const CANCEL_REQUEST_TIMEOUT_MS = 5000

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

const RELAYER: ProviderName = 'openzeppelin'

async function fetchRelayerAddressesFromOZ(
  fetcher: IFetchComponent,
  relayerURL: string,
  authHeaders: Record<string, string>
): Promise<Set<string>> {
  const response = await fetcher.fetch(`${relayerURL}/api/v1/relayers/`, {
    headers: authHeaders,
    timeout: RELAYERS_FETCH_TIMEOUT_MS,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `OZ listRelayers responded with ${response.status}: ${body}`
    )
  }

  const { data } = (await response.json()) as OZResponse<OZRelayerInfo[]>
  if (!data) {
    throw new Error('OZ listRelayers returned an empty payload')
  }

  return new Set(
    data
      .map((relayer) => relayer.address?.toLowerCase())
      .filter((address): address is string => Boolean(address))
  )
}

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

  const maxStatusChecks =
    (await config.getNumber('OZ_MAX_STATUS_CHECKS')) ??
    DEFAULT_MAX_STATUS_CHECKS
  const sleepTimeBetweenChecks =
    (await config.getNumber('OZ_SLEEP_TIME_BETWEEN_CHECKS_MS')) ??
    DEFAULT_SLEEP_TIME_BETWEEN_CHECKS_MS
  const relayersFetchIntervalMs =
    (await config.getNumber('OZ_RELAYERS_FETCH_INTERVAL_MS')) ??
    DEFAULT_RELAYERS_FETCH_INTERVAL_MS

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  /**
   * Best-effort DELETE against the OZ Relayer to cancel a transaction that
   * never broadcast. Never throws — failures are logged and counted under
   * dcl_error_service_errors{relayer="openzeppelin"} so the surrounding
   * timeout error still propagates to the caller.
   *
   * @param txId - OZ Relayer transaction id to cancel.
   */
  async function cancelTransaction(txId: string): Promise<void> {
    try {
      const response = await fetcher.fetch(
        `${relayerURL}/api/v1/relayers/${relayerId}/transactions/${txId}`,
        {
          method: 'DELETE',
          headers: authHeaders,
          timeout: CANCEL_REQUEST_TIMEOUT_MS,
        }
      )
      if (!response.ok) {
        const body = await response.text()
        logger.error('OpenZeppelin cancel responded with a non-2xx status', {
          txId,
          status: response.status,
          body,
        })
        metrics.increment('dcl_error_service_errors', { relayer: RELAYER })
      }
    } catch (error: unknown) {
      logger.error('OpenZeppelin cancel request failed', {
        txId,
        error: getErrorMessage(error),
      })
      metrics.increment('dcl_error_service_errors', { relayer: RELAYER })
    }
  }

  let cachedRelayerAddresses: Set<string> = new Set()
  let lastRelayersFetchAt = 0

  const getRelayerAddresses = async (): Promise<Set<string>> => {
    const isStale = Date.now() - lastRelayersFetchAt > relayersFetchIntervalMs
    if (cachedRelayerAddresses.size > 0 && !isStale) {
      return cachedRelayerAddresses
    }

    try {
      cachedRelayerAddresses = await fetchRelayerAddressesFromOZ(
        fetcher,
        relayerURL,
        authHeaders
      )
      lastRelayersFetchAt = Date.now()
      return cachedRelayerAddresses
    } catch (error) {
      logger.warn('Failed to refresh OZ relayer addresses', {
        message: getErrorMessage(error),
        cachedCount: cachedRelayerAddresses.size,
      })
      metrics.increment('dcl_error_relayer_addresses_refresh_failed')
      return cachedRelayerAddresses
    }
  }

  /**
   * Polls the OZ tx-detail endpoint until the relayer either broadcasts the
   * transaction (a hash plus a submitted/mined/confirmed status) or reports
   * a terminal failure (canceled/failed/expired). On budget exhaustion the
   * function asks OZ to cancel the stuck transaction (best-effort) and
   * throws RelayerTimeout.
   *
   * @param txId - OZ Relayer transaction id returned from the POST.
   * @returns The on-chain hash assigned by the relayer.
   * @throws InvalidTransactionError when the relayer reports a terminal failure.
   * @throws RelayerTimeout when the polling budget is exhausted.
   */
  async function waitForBroadcast(txId: string): Promise<string> {
    const url = `${relayerURL}/api/v1/relayers/${relayerId}/transactions/${txId}`

    for (let checks = 0; checks < maxStatusChecks; checks++) {
      await sleep(sleepTimeBetweenChecks)

      let response: any
      try {
        response = await fetcher.fetch(url, { headers: authHeaders })
      } catch (error: unknown) {
        logger.error('OpenZeppelin poll attempt failed', {
          txId,
          attempt: checks + 1,
          error: getErrorMessage(error),
        })
        continue
      }

      if (!response.ok) continue

      const { data } = (await response.json()) as OZResponse<OZTransactionData>
      if (!data) continue

      if (FAILED_STATUSES.has(data.status)) {
        const reason = data.status_reason || data.status
        logger.error('OpenZeppelin transaction reached a terminal failure', {
          txId,
          status: data.status,
          reason,
        })

        if (data.status === OZTransactionStatus.Canceled) {
          metrics.increment('dcl_error_cancelled_transactions', {
            relayer: RELAYER,
          })
        } else if (containsAny(data.status_reason, REVERT_KEYWORDS)) {
          metrics.increment('dcl_error_reverted_transactions', {
            relayer: RELAYER,
          })
        } else {
          metrics.increment('dcl_error_service_errors', { relayer: RELAYER })
        }

        throw new BroadcastFailedError(
          `Transaction ${data.status}: ${reason}`,
          ErrorCode.EXPECTATION_FAILED
        )
      }

      if (BROADCAST_STATUSES.has(data.status) && data.hash) {
        return data.hash
      }
      // status is still 'pending'/'sent' or hash not yet assigned — keep polling.
    }

    logger.error('OpenZeppelin polling budget exhausted', {
      txId,
      attempts: maxStatusChecks,
    })
    metrics.increment('dcl_error_timeout', { relayer: RELAYER })
    await cancelTransaction(txId)
    throw new RelayerTimeout('The limit of status checks was reached')
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
      metrics.increment('dcl_error_service_errors', { relayer: RELAYER })
      throw new RelayerError(500, message)
    }

    if (!response.ok) {
      const body = await response.text()
      logger.error(
        `OpenZeppelin relayer responded with ${response.status}: ${body}`
      )
      metrics.increment('dcl_error_service_errors', { relayer: RELAYER })

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
      metrics.increment('dcl_error_service_errors', { relayer: RELAYER })
      throw new RelayerError(
        500,
        error || 'Unexpected response from OZ Relayer'
      )
    }

    // Only short-circuit when the POST already reports a broadcast status —
    // a 'pending'/'sent' status with a hash would still be in OZ's queue.
    const hash =
      txData.hash && BROADCAST_STATUSES.has(txData.status)
        ? txData.hash
        : await waitForBroadcast(txData.id)

    metrics.increment('dcl_sent_transactions', { relayer: RELAYER })
    logger.info('OpenZeppelin relayed transaction', {
      txId: txData.id,
      hash,
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
    getRelayerAddresses,
  }
}
