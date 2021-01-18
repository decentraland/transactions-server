import Ajv from 'ajv'
import { Schema } from '../types/validation'

const ajv = new Ajv()

export function check<T>(schema: Schema<T>, data: any) {
  const validator = ajv.compile<T>(schema)
  validator(data)
  if (validator.errors) {
    throw new Error(`Invalid data: ${JSON.stringify(validator.errors)}`)
  }
}

export function validate<T>(schema: Schema<T>, data: any): data is T {
  return ajv.validate<T>(schema, data)
}
