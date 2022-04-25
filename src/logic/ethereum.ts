import { utils } from 'ethers'
import { ChainName, ChainId, getChainId } from '@dcl/schemas'
import { ContractData } from 'decentraland-transactions'
import { getNetworkMapping } from '@dcl/schemas/dist/dapps/chain-id'

export function getMaticChainIdFromChainName(chainName: ChainName): ChainId {
  const chainId = getChainId(chainName)
  if (!chainId) {
    throw new Error(
      `The chain name ${chainName} doesn't have a matic chain id to map to`
    )
  }
  return getNetworkMapping(chainId).MATIC
}

/**
 * Decode the data for a function call, splitting it into the different arguments
 * It thorws if the data, method or abi are incorrect
 * @param abi - Contract abi
 * @param methodName - Method to decode
 * @param data - data to decode (tx.data)
 */
export function decodeFunctionData(
  abi: ContractData['abi'],
  methodName: string,
  data: string
): utils.Result {
  const contractInterface = new utils.Interface(abi)
  return contractInterface.decodeFunctionData(methodName, data)
}
