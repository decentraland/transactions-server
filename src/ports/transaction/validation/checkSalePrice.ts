import { ChainId, ChainName } from '@dcl/schemas'
import { ContractName, getContract } from 'decentraland-transactions'
import { BigNumber } from 'ethers'
import {
  decodeFunctionData,
  getMaticChainIdFromChainName,
} from '../../../logic/ethereum'
import { InvalidSalePriceError } from '../errors'
import { TransactionData } from '../types'
import { ITransactionValidator } from './types'

export const checkSalePrice: ITransactionValidator = async (
  components,
  transactionData
) => {
  const { config, metrics } = components
  const { params } = transactionData

  const minPriceInWei = await config.requireString('MIN_SALE_VALUE_IN_WEI')
  const chainName = (await config.requireString('CHAIN_NAME')) as ChainName
  const salePrice = getSalePrice(
    params,
    getMaticChainIdFromChainName(chainName)
  )

  if (salePrice !== null && BigNumber.from(salePrice).lte(minPriceInWei)) {
    metrics.increment('dcl_error_sale_price_too_low', {
      contract: params[0],
      minPrice: minPriceInWei,
      salePrice,
    })
    throw new InvalidSalePriceError(minPriceInWei, salePrice)
  }
}

/**
 * Tries to get the corresponding sale price for the transaction data sent.
 * It'll return a string representing the value in wei,if the data corresponds to any of the sales we're watching, and null otherwise
 * @param params - Transaction data params
 */
export function getSalePrice(
  params: TransactionData['params'],
  chainId: ChainId
): string | null {
  const [contractAddress, fullData] = params

  const store = getContract(ContractName.CollectionStore, chainId)
  const marketplace = getContract(ContractName.MarketplaceV2, chainId)
  const bid = getContract(ContractName.BidV2, chainId)

  try {
    const { functionSignature: data } = decodeFunctionData(
      store.abi, // Either abi works, we just need one that has the executeMetaTransaction method for the first decode
      'executeMetaTransaction',
      fullData
    )

    switch (contractAddress) {
      case store.address: {
        const [[{ prices }]] = decodeFunctionData(store.abi, 'buy', data)
        return prices[0].toString()
      }
      case marketplace.address: {
        const { price } = decodeFunctionData(
          marketplace.abi,
          'executeOrder',
          data
        )
        return price.toString()
      }
      case bid.address: {
        const { _price } = decodeFunctionData(
          bid.abi,
          'placeBid(address,uint256,uint256,uint256)',
          data
        )
        return _price.toString()
      }
      default:
        return null
    }
  } catch (error) {
    return null
  }
}
