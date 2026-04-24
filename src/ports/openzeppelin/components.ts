import { createPublicClient, http } from 'viem'
import { ErrorCode } from 'decentraland-transactions'
import { AppComponents } from '../../types'
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
}

// The status endpoint includes balance, pending count, and nonce
type OZStatusData = {
  balance: string
  pending_transactions_count: number
  nonce: string
  paused: boolean
  system_disabled: boolean
}

// Terminal transaction statuses that indicate the tx will never get a hash
const FAILED_STATUSES = new Set(['failed', 'invalid', 'cancelled'])

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

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  async function pollForHash(txId: string): Promise<string> {
    const maxAttempts = 30
    const pollIntervalMs = 2000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))

      let response: any
      try {
        response = await fetcher.fetch(
          `${relayerURL}/api/v1/relayers/${relayerId}/transactions/${txId}`,
          { headers: authHeaders }
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger.error(
          `OpenZeppelin poll attempt ${attempt + 1} failed: ${message}`
        )
        continue
      }

      if (!response.ok) continue

      const { data } = (await response.json()) as OZResponse<OZTransactionData>

      if (!data) continue

      if (FAILED_STATUSES.has(data.status)) {
        const reason = data.status_reason || data.status
        logger.error(`OpenZeppelin transaction ${txId} failed: ${reason}`)
        metrics.increment('dcl_error_service_errors_openzeppelin')
        throw new InvalidTransactionError(
          `Transaction ${data.status}: ${reason}`,
          ErrorCode.EXPECTATION_FAILED
        )
      }

      if (data.hash) {
        return data.hash
      }
    }

    metrics.increment('dcl_error_timeout_openzeppelin')
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
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

  // readynessProbe is picked up by @well-known-components/http-server's
  // createStatusCheckComponent for the /health/ready endpoint
  const readynessProbe = async (): Promise<boolean> => {
    try {
      const response = await fetcher.fetch(
        `${relayerURL}/api/v1/relayers/${relayerId}/status`,
        { headers: authHeaders }
      )

      if (!response.ok) {
        logger.error(
          `OZ Relayer health check failed with status ${response.status}`
        )
        return false
      }

      const { success, data } =
        (await response.json()) as OZResponse<OZStatusData>

      if (!success || !data) {
        logger.error('OZ Relayer health check returned unexpected response')
        return false
      }

      logger.info(
        `OZ Relayer health - balance: ${data.balance} wei, pending: ${data.pending_transactions_count}, nonce: ${data.nonce}`
      )

      return BigInt(data.balance) > 0n
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error(`OZ Relayer health check failed: ${message}`)
      return false
    }
  }

  return {
    getNetworkGasPrice,
    sendMetaTransaction,
    readynessProbe,
  }
}
