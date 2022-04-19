import { BigNumber, utils } from 'ethers'
import { ChainName, ChainId } from '@dcl/schemas'
import { ContractData } from 'decentraland-transactions'

export function getMaticChainIdFromNetwork(network: ChainName): ChainId {
  switch (network) {
    case ChainName.ETHEREUM_MAINNET:
      return ChainId.MATIC_MAINNET
    case ChainName.ETHEREUM_ROPSTEN:
      return ChainId.MATIC_MUMBAI
    default:
      throw new Error(
        `The chain name ${network} doesn't have a matic chain id to map to`
      )
  }
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
