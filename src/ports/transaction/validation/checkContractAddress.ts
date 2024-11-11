import { InvalidContractAddressError } from '../../../types/transactions/errors'
import { ITransactionValidator } from './types'

export const checkContractAddress: ITransactionValidator = async (
  components,
  transactionData
) => {
  const { contracts } = components
  const { params } = transactionData

  const contractAddress = params[0]
  if (!(await contracts.isValidAddress(contractAddress))) {
    throw new InvalidContractAddressError(contractAddress)
  }
}
