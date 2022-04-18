import { generateValidator } from '../../../logic/validation'
import { InvalidSchemaError } from '../errors'
import { transactionSchema } from '../types'
import { ITransactionValidator } from './types'

const validateSchema = generateValidator(transactionSchema)

export const checkSchema: ITransactionValidator = async (
  _components,
  transactionData
) => {
  if (!validateSchema(transactionData)) {
    throw new InvalidSchemaError(validateSchema.errors)
  }
}
