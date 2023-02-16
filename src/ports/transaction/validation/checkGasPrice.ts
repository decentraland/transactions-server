import { ChainId, ChainName } from '@dcl/schemas'
import { parseUnits } from '@ethersproject/units'
import { BigNumber } from 'ethers'
import { getMaticChainIdFromChainName } from '../../../logic/ethereum'
import { AppComponents } from '../../../types'
import { ApplicationName } from '../../features'
import { GasPriceResponse, IGasPriceValidator } from './types'

const FF_MAX_GAS_PRICE_ALLOWED_IN_WEI = 'gas-price'

export const checkGasPrice: IGasPriceValidator = async (components) => {
  const { config, features } = components
  const chainName = (await config.requireString('CHAIN_NAME')) as ChainName

  const isGasPriceAllowedFFEnabled = await features.getIsFeatureEnabled(
    ApplicationName.BUILDER,
    FF_MAX_GAS_PRICE_ALLOWED_IN_WEI
  )

  if (isGasPriceAllowedFFEnabled) {
    const maxGasPriceAllowed = await getMaxGasPriceAllowed(components)
    const chainId = getMaticChainIdFromChainName(chainName)

    const currentGasPrice = await getNetworkGasPrice(components, chainId)

    if (!currentGasPrice) {
      throw new Error(
        `Could not get current gas price for the network: ${chainName}.`
      )
    }

    if (currentGasPrice.gt(maxGasPriceAllowed)) {
      throw new Error('Current gas price exceeds max gas price allowed.')
    }
  }
}

/**
 * Tries to get the max gas price allowed from the FF.
 * It'll return a BigNumber value in wei, and null otherwise
 * @param components - Config | Features | Fetcher | Logs components
 */

export const getMaxGasPriceAllowed = async (
  components: Pick<AppComponents, 'config' | 'features' | 'fetcher' | 'logs'>
) => {
  const { features } = components
  const gasPriceAllowedVariant = await features.getFeatureVariant(
    ApplicationName.BUILDER,
    FF_MAX_GAS_PRICE_ALLOWED_IN_WEI
  )

  if (!gasPriceAllowedVariant) {
    throw new Error('Max gas price allowed is not defined')
  }

  return BigNumber.from(gasPriceAllowedVariant.payload.value)
}

/**
 * Tries to get the current network gas price.
 * It'll return a BigNumber value in wei, and null otherwise
 * @param components - Config | Features | Fetcher | Logs components
 * @param chainId - Network Chain ID
 */
export const getNetworkGasPrice = async (
  components: Pick<AppComponents, 'config' | 'features' | 'fetcher' | 'logs'>,
  chainId: ChainId
): Promise<BigNumber | null> => {
  const { config, fetcher, logs } = components
  const logger = logs.getLogger('transactions-server')
  const biconomyAPIURL = await config.requireString('BICONOMY_API_V1_URL')

  try {
    const response = await fetcher.fetch(
      `${biconomyAPIURL}/gas-price?networkId=${chainId}`
    )
    if (response.ok) {
      const result: GasPriceResponse = await response.json()
      let gasPriceInWei: BigNumber
      if (result.gasPrice.unit !== 'wei') {
        gasPriceInWei = parseUnits(
          result.gasPrice.value.toString(),
          result.gasPrice.unit
        )
      } else {
        gasPriceInWei = BigNumber.from(result.gasPrice.value.toString())
      }

      return gasPriceInWei
    }
  } catch (error) {
    logger.error(error as Error)
  }

  return null
}
