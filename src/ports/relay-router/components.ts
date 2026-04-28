import { ApplicationName } from '@well-known-components/features-component'
import { ChainId } from '@dcl/schemas'
import { AppComponents } from '../../types'
import {
  IMetaTransactionProviderComponent,
  TransactionData,
} from '../../types/transactions/transactions'
import { Feature } from '../features'
import { IRelayRouterComponent } from './types'

// Routes each transaction based on the 'relay-provider' feature flag variant.
// Accepted variant payload.value:
//   - "gelato"       → always Gelato
//   - "openzeppelin" → always OpenZeppelin
//   - "random" / missing / unknown → random pick between the configured providers
export function createRelayRouterComponent(
  components: Pick<AppComponents, 'logs' | 'features'> & {
    gelato?: IMetaTransactionProviderComponent
    openzeppelin?: IMetaTransactionProviderComponent
  }
): IRelayRouterComponent {
  const { logs, features, gelato, openzeppelin } = components
  const logger = logs.getLogger('relay-router')

  const available: Record<string, IMetaTransactionProviderComponent> = {}
  if (gelato) available.gelato = gelato
  if (openzeppelin) available.openzeppelin = openzeppelin

  const availableNames = Object.keys(available)
  if (availableNames.length === 0) {
    throw new Error(
      'relay-router: no providers configured; set GELATO_API_KEY or OZ_RELAYER_URL to enable at least one relayer'
    )
  }

  async function resolveProvider(): Promise<{
    name: string
    provider: IMetaTransactionProviderComponent
  }> {
    let desired: string | undefined
    try {
      const variant = await features.getFeatureVariant(
        ApplicationName.DAPPS,
        Feature.RELAY_PROVIDER
      )
      desired = variant?.payload?.value
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.warn(`relay-provider FF lookup failed, falling back: ${message}`)
    }

    if (desired && desired !== 'random' && available[desired]) {
      return { name: desired, provider: available[desired] }
    }

    if (desired && desired !== 'random' && !available[desired]) {
      logger.warn(
        `relay-provider FF asked for "${desired}" but it is not configured; falling back to random`
      )
    }

    const name =
      availableNames[Math.floor(Math.random() * availableNames.length)]
    return { name, provider: available[name] }
  }

  const sendMetaTransaction = async (tx: TransactionData): Promise<string> => {
    const { name, provider } = await resolveProvider()
    logger.info(`Routing transaction from ${tx.from} to ${name}`)
    return provider.sendMetaTransaction(tx)
  }

  // Gelato exposes a real RPC-backed gas price; OZ returns null unless RPC_URL
  // is set. Prefer whichever returns a value.
  const getNetworkGasPrice = async (
    chainId: ChainId
  ): Promise<bigint | null> => {
    if (gelato) {
      const price = await gelato.getNetworkGasPrice(chainId)
      if (price !== null) return price
    }
    if (openzeppelin) {
      return openzeppelin.getNetworkGasPrice(chainId)
    }
    return null
  }

  return {
    sendMetaTransaction,
    getNetworkGasPrice,
  }
}
