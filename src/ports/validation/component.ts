import 'isomorphic-fetch'
import Ajv from 'ajv'
import { AppComponents } from '../../types'
import { IValidationComponent, Schema } from './types'

export async function createValidationComponent(
  components: Pick<AppComponents, 'logs'>
): Promise<IValidationComponent> {
  const { logs } = components
  const logger = logs.getLogger('validations-component')

  const ajv = new Ajv()

  // Methods
  function require<T>(schema: Schema<T>, data: any) {
    logger.debug('Requiring object with schema', schema)
    const validator = ajv.compile<T>(schema)
    validator(data)
    if (validator.errors) {
      throw new Error(`Invalid data: ${JSON.stringify(validator.errors)}`)
    }
  }

  function validate<T>(schema: Schema<T>, data: any): data is T {
    // TODO: Should we make errors available in this case?
    logger.debug('Validating object with schema', schema)
    return ajv.validate<T>(schema, data)
  }

  return {
    require,
    validate,
  }
}
