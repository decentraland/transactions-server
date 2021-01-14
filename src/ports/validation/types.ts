import { JSONSchemaType } from 'ajv'

export interface IValidationComponent {
  require: <T>(schema: Schema<T>, data: any) => void
  validate: <T>(schema: Schema<T>, data: any) => data is T
}

export type Schema<T> = JSONSchemaType<T>
