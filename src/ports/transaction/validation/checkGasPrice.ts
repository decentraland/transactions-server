import { ChainId, ChainName } from '@dcl/schemas'
import { parseUnits } from '@ethersproject/units'
import { BigNumber } from 'ethers'
import { ContractName, getContract } from 'decentraland-transactions'
import {
  decodeFunctionData,
  getMaticChainIdFromChainName,
} from '../../../logic/ethereum'
import { AppComponents } from '../../../types'
import { ApplicationName } from '../../features'
import { HighCongestionError } from '../errors'
import { TransactionData } from '../types'
import { GasPriceResponse, IGasPriceValidator } from './types'

const FF_MAX_GAS_PRICE_ALLOWED_IN_WEI = 'max-gas-price-allowed'

export const checkGasPrice: IGasPriceValidator = async (
  components,
  transactionData
) => {
  const { config, features } = components
  const chainName = (await config.requireString('CHAIN_NAME')) as ChainName

  const isGasPriceAllowedFFEnabled = await features.getIsFeatureEnabled(
    ApplicationName.DAPPS,
    FF_MAX_GAS_PRICE_ALLOWED_IN_WEI
  )

  if (isGasPriceAllowedFFEnabled) {
    const chainId = getMaticChainIdFromChainName(chainName)

    if (
      !(await isMethodAllowedToSkipMaxGasPriceCheck(
        components,
        transactionData,
        chainId
      ))
    ) {
      const maxGasPriceAllowed = await getMaxGasPriceAllowed(components)

      const currentGasPrice = await getNetworkGasPrice(components, chainId)

      if (!currentGasPrice) {
        throw new Error(
          `Could not get current gas price for the network: ${chainName}.`
        )
      }

      if (currentGasPrice.gt(maxGasPriceAllowed)) {
        throw new HighCongestionError(
          currentGasPrice.toString(),
          maxGasPriceAllowed.toString()
        )
      }
    }
  }
}

/**
 * Tries to get the max gas price allowed from the FF.
 * It'll return a BigNumber value in wei, and null otherwise
 * @param components - Config | Features | Fetcher | Logs components
 */

const getMaxGasPriceAllowed = async (
  components: Pick<AppComponents, 'config' | 'features' | 'fetcher' | 'logs'>
) => {
  const { features } = components
  const gasPriceAllowedVariant = await features.getFeatureVariant(
    ApplicationName.DAPPS,
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
const getNetworkGasPrice = async (
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
      return parseUnits(result.gasPrice.value.toString(), result.gasPrice.unit)
    } else {
      throw new Error(`Could not fetch the gas price from ${biconomyAPIURL}`)
    }
  } catch (error) {
    logger.error(error as Error)
  }

  return null
}

/**
 * Tries to get if the transaction contract method is allowed to skip the max gas price allowed check.
 * It'll return a boolean value
 * @param components - Config | Contract | Features | Fetcher | Logs components
 * @param chainId - Network Chain ID
 * @param transactionData - Transaction data params
 */
const isMethodAllowedToSkipMaxGasPriceCheck = async (
  components: Pick<
    AppComponents,
    'config' | 'contracts' | 'features' | 'fetcher' | 'logs'
  >,
  transactionData: TransactionData,
  chainId: ChainId
) => {
  const { contracts } = components
  const manager = getContract(ContractName.CollectionManager, chainId)
  const factory = getContract(ContractName.CollectionFactoryV3, chainId)
  const store = getContract(ContractName.CollectionStore, chainId)
  const collection = getContract(ContractName.ERC721CollectionV2, chainId)
  const manaConfig = getContract(ContractName.MANAToken, chainId)

  const [contractAddress, fullData] = transactionData['params']

  try {
    const { functionSignature: data } = decodeFunctionData(
      manager.abi, // Either abi works, we just need one that has the executeMetaTransaction method for the first decode
      'executeMetaTransaction',
      fullData
    )

    // Allow the collection manager to create collections using the CollectionFactoryV3
    if (contractAddress === manager.address) {
      const { _factory: collectionFactoryAddress } = decodeFunctionData(
        manager.abi,
        'createCollection',
        data
      )

      return collectionFactoryAddress === factory.address
    }

    // Approve the collection manager to spend mana on behalf of the user
    if (contractAddress === manaConfig.address) {
      const { spender: contractToAuthorizeToSpend } = decodeFunctionData(
        manaConfig.abi,
        'approve',
        data
      )

      return contractToAuthorizeToSpend === manager.address
    }

    // Allow/Disallow the collection store to mint items
    if (await contracts.isCollectionAddress(contractAddress)) {
      const { _minters: contractsAuthorizedToMint } = decodeFunctionData(
        collection.abi,
        'setMinters',
        data
      )

      return contractsAuthorizedToMint.includes(store.address)
    }
  } catch (error) {
    // When the decode fails, we just return false
  }

  return false
}
