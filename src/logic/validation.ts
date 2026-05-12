import Ajv from 'ajv'
import type { Schema } from '../types/validation'
import type { ValidateFunction } from 'ajv'

const ajv = new Ajv()

export function generateValidator<T>(schema: Schema<T>): ValidateFunction<T> {
  return ajv.compile<T>(schema)
}
