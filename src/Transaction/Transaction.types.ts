export type TransactionAttributes = {
  userAddress: string
  to: string
  params: string
}

export const transactionSchema = Object.freeze({
  type: 'object',
  properties: {
    userAddress: { type: 'string' },
    to: { type: 'string' },
    params: { type: 'array' },
  },
  additionalProperties: false,
  removeAdditional: true,
  required: ['userAddress', 'params']
})
