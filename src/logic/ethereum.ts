import {
  decodeFunctionData as viemDecodeFunctionData,
  encodeFunctionData as viemEncodeFunctionData,
  Abi,
  AbiFunction,
  Hex,
} from 'viem'
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
): any[] & Record<string, any> {
  const viemAbi = abi as Abi
  const { args } = viemDecodeFunctionData({
    abi: viemAbi,
    data: data as Hex,
  })

  // Find the matching ABI function to get parameter names
  const abiFunction = (viemAbi as AbiFunction[]).find(
    (item) =>
      item.type === 'function' &&
      (item.name === methodName ||
        `${item.name}(${item.inputs.map((i) => i.type).join(',')})` ===
          methodName)
  )

  if (!abiFunction) {
    throw new Error(`Function "${methodName}" not found in ABI`)
  }

  // Build a result array with named properties (like ethers' Result)
  const decodedArgs = args as readonly unknown[]
  const result: any[] & Record<string, any> = [...decodedArgs] as any
  abiFunction.inputs.forEach((input, i) => {
    if (input.name) {
      result[input.name] = decodedArgs[i]
    }
  })

  return result
}

/**
 * Encode the data for a function call
 * It thorws if the data, method or abi are incorrect
 * @param abi - Contract abi
 * @param methodName - Method to encode
 * @param data - Arguments to encode (transaction.params)
 */
export function encodeFunctionData(
  abi: ContractData['abi'],
  methodName: string,
  data: string[]
): string {
  return viemEncodeFunctionData({
    abi: abi as Abi,
    functionName: methodName,
    args: data,
  })
}
