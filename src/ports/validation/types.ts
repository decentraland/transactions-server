import { JSONSchemaType } from 'ajv'

export type IValidationComponent = {
  require: <T>(schema: Schema<T>, data: any) => void
  validate: <T>(schema: Schema<T>, data: any) => data is T
}

export type Schema<T> = JSONSchemaType<T>
