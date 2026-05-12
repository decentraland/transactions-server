import { decodeFunctionData as viemDecodeFunctionData } from 'viem'
import type { ChainId, ChainName } from '@dcl/schemas'
import { ContractName, getContract } from 'decentraland-transactions'
import { META_TX_ABI } from './abis'
import {
  decodeFunctionData,
  getMaticChainIdFromChainName,
} from '../../../logic/ethereum'
import { InvalidSalePriceError } from '../../../types/transactions/errors'
import type { ITransactionValidator } from './types'
import type { TransactionData } from '../../../types/transactions/transactions'
import type { Hex } from 'viem'

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

  if (salePrice !== null && BigInt(salePrice) < BigInt(minPriceInWei)) {
    metrics.increment('dcl_error_sale_price_too_low', {
      minPrice: minPriceInWei,
      salePrice,
    })
    throw new InvalidSalePriceError(minPriceInWei, salePrice)
  }
}

type SalePriceDecoder = (innerCallData: string) => string

// Some contracts are not deployed on every supported chain. Try-fetch lets us
// register a decoder only for the chains where the contract exists.
function tryGetContract(name: ContractName, chainId: ChainId) {
  try {
    return getContract(name, chainId)
  } catch {
    return null
  }
}

function getSaleDecoders(chainId: ChainId): Map<string, SalePriceDecoder> {
  const decoders = new Map<string, SalePriceDecoder>()

  const store = tryGetContract(ContractName.CollectionStore, chainId)
  if (store) {
    decoders.set(store.address.toLowerCase(), (data) => {
      const [[{ prices }]] = decodeFunctionData(store.abi, 'buy', data)
      return prices[0].toString()
    })
  }

  const marketplace = tryGetContract(ContractName.MarketplaceV2, chainId)
  if (marketplace) {
    decoders.set(marketplace.address.toLowerCase(), (data) => {
      const { price } = decodeFunctionData(
        marketplace.abi,
        'executeOrder',
        data
      )
      return price.toString()
    })
  }

  const bid = tryGetContract(ContractName.BidV2, chainId)
  if (bid) {
    decoders.set(bid.address.toLowerCase(), (data) => {
      const { _price } = decodeFunctionData(
        bid.abi,
        'placeBid(address,uint256,uint256,uint256)',
        data
      )
      return _price.toString()
    })
  }

  const offChain = tryGetContract(ContractName.OffChainMarketplace, chainId)
  if (offChain) {
    decoders.set(offChain.address.toLowerCase(), (data) => {
      // accept(_trades) — batch of Trade structs. Take the MIN received-asset
      // value across all trades; any single sub-floor trade trips the check.
      const decoded = decodeFunctionData(offChain.abi, 'accept', data)
      const trades = (decoded[0] ?? decoded._trades ?? []) as Array<{
        received?: Array<{ value: bigint | string | number }>
      }>

      let minValue: bigint | null = null
      for (const trade of trades) {
        for (const asset of trade.received ?? []) {
          const v = BigInt(asset.value)
          if (minValue === null || v < minValue) minValue = v
        }
      }
      return (minValue ?? 0n).toString()
    })
  }

  return decoders
}

/**
 * Extracts the sale price from a meta-tx targeting one of the registered DCL
 * sale contracts. Returns:
 *  - `null` when the target is not a registered sale contract.
 *  - the extracted price string when decoding succeeds.
 *  - `'0'` when the target is a registered sale contract but decoding fails.
 *
 * @param params - Transaction data params (params[0] = contract, params[1] = calldata)
 */
export function getSalePrice(
  params: TransactionData['params'],
  chainId: ChainId
): string | null {
  const [contractAddress, fullData] = params
  if (!contractAddress || !fullData) return null

  const decoder = getSaleDecoders(chainId).get(contractAddress.toLowerCase())
  if (!decoder) return null

  let innerCallData: string
  try {
    const decoded = viemDecodeFunctionData({
      abi: META_TX_ABI,
      data: fullData as Hex,
    })
    innerCallData = decoded.args[1] as string
  } catch {
    return '0'
  }

  try {
    return decoder(innerCallData)
  } catch {
    return '0'
  }
}
