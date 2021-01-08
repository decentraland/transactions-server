import { IHttpServerComponent } from '@well-known-components/interfaces'
import { AppComponents } from '../types'

export function getUserTransactions<T>(
  components: Pick<AppComponents, 'logs'>
): IHttpServerComponent.IRequestHandler<T> {
  const { logs } = components
  const logger = logs.getLogger('transactions-server')

  return async (context) => {
    logger.info(`Returning transactions for ${context.params.user_address}`)
    return {
      status: 200,
      body: 'OK',
    }
  }
}

export function sendTransaction<T>(
  components: Pick<AppComponents, 'logs'>
): IHttpServerComponent.IRequestHandler<T> {
  const { logs } = components
  const logger = logs.getLogger('transactions-server')

  return async (context) => {
    const { transaction } = await context.request.json()
    /*
    {
      "transaction": {
        "userAddress": "0x1d9aa2025b67f0f21d1603ce521bda7869098f8a",
        "to": "0xfe4F5145f6e09952a5ba9e956ED0C25e3Fa4c7F1",
        "params": [
          "0x1d9aa2025b67f0f21d1603ce521bda7869098f8a",
          "0xa9059cbb000000000000000000000000a8d82b0bf686eee78eb5ec882cac98fdd1335ef50000000000000000000000000000000000000000000000000000000000000001",
          "0x4a91a2a73c9c37f6581f408f2a3991161d945687ccfbcb20d7a7bed747ca0238",
          "0x1e6ee21e7a472a21700946008463dd9855bdb429ff46f871fb0e9b7577fc3f18",
          "0x1c"
        ]
      }
    }
    */

    logger.info(`Sending transaction for ${transaction.userAddress}`)
    return {
      status: 200,
      body: { ok: true },
    }
  }
}
