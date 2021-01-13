import 'isomorphic-fetch'
import { AppComponents } from '../../types'
import {
  ITransactionComponent,
  MetaTransactionRequest,
  MetaTransactionResponse,
  TransactionData,
} from './types'

export async function createTransactionComponent(
  components: Pick<AppComponents, 'config' | 'logs'>
): Promise<ITransactionComponent> {
  const { config, logs } = components
  const logger = logs.getLogger('transaction-component')

  // Config
  const biconomiAPIId = await config.requireString('BICONOMY_API_ID')
  const biconomyAPIKey = await config.requireString('BICONOMY_API_KEY')
  const biconomyAPIURL = await config.requireString('BICONOMY_API_URL')

  logger.debug(`URL for meta transactions: ${biconomyAPIURL}`)

  // Methods
  async function sendMetaTransaction(transactionData: TransactionData) {
    const body: MetaTransactionRequest = {
      apiId: biconomiAPIId,
      ...transactionData,
    }
    const result = await fetch(biconomyAPIURL, {
      headers: {
        'x-api-key': biconomyAPIKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      method: 'POST',
    })
    return result.json() as Promise<MetaTransactionResponse>
  }

  return {
    sendMetaTransaction,
  }
}
