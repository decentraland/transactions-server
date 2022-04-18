import { ChainId, ChainName } from '@dcl/schemas'
import { ContractName, getContract } from 'decentraland-transactions'
import {
  decodeFunctionData,
  getMaticChainIdFromNetwork,
  weiToFloat,
} from '../../../logic/ethereum'
import { InvalidSalePriceError } from '../errors'
import { TransactionData } from '../types'
import { ITransactionValidator } from './types'

export const checkSalePrice: ITransactionValidator = async (
  components,
  transactionData
) => {
  const { config } = components
  const { params } = transactionData

  const minPrice = await config.requireNumber('MIN_SALE_VALUE')
  const chainName = (await config.requireString('CHAIN_NAME')) as ChainName
  const salePrice = getSalePrice(params, getMaticChainIdFromNetwork(chainName))

  if (salePrice !== null && salePrice <= minPrice) {
    throw new InvalidSalePriceError(minPrice, salePrice)
  }
}

/**
 * Tries to get the corresponding sale price for the transaction data sent.
 * It'll return a number (converted from wei) if the data corresponds to any of the sales we're watching and null otherwise
 * @param params - Transaction data params
 */
export function getSalePrice(
  params: TransactionData['params'],
  chainId: ChainId
): number | null {
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
        const weiPrice = prices[0]
        return weiToFloat(weiPrice)
      }
      case marketplace.address: {
        const { price: weiPrice } = decodeFunctionData(
          marketplace.abi,
          'executeOrder',
          data
        )
        return weiToFloat(weiPrice)
      }
      case bid.address: {
        const { _price: weiPrice } = decodeFunctionData(
          bid.abi,
          'placeBid(address,uint256,uint256,uint256)',
          data
        )
        return weiToFloat(weiPrice)
      }
      default:
        return null
    }
  } catch (error) {
    return null
  }
}
