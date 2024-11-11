import { isErrorWithMessage } from '../../../src/logic/errors'

describe("when checking a value to see if it's an error with message", () => {
  let error: any

  describe('and the value is an Error', () => {
    beforeEach(() => {
      error = new Error('An error occurred')
    })

    it('should return true', () => {
      expect(isErrorWithMessage(error)).toBe(true)
    })
  })

  describe('and the value is an object without a message', () => {
    beforeEach(() => {
      error = { aKey: 'aValue' }
    })

    it('should return false', () => {
      expect(isErrorWithMessage(error)).toBe(false)
    })
  })

  describe('and the value is a string', () => {
    beforeEach(() => {
      error = 'An error occurred'
    })

    it('should return false', () => {
      expect(isErrorWithMessage(error)).toBe(false)
    })
  })

  describe('and the value is a number', () => {
    beforeEach(() => {
      error = 500
    })

    it('should return false', () => {
      expect(isErrorWithMessage(error)).toBe(false)
    })
  })

  describe('and the value is a boolean', () => {
    beforeEach(() => {
      error = true
    })

    it('should return false', () => {
      expect(isErrorWithMessage(error)).toBe(false)
    })
  })

  describe('and the value is undefined', () => {
    beforeEach(() => {
      error = undefined
    })

    it('should return false', () => {
      expect(isErrorWithMessage(error)).toBe(false)
    })
  })

  describe('and the value is null', () => {
    beforeEach(() => {
      error = null
    })

    it('should return false', () => {
      expect(isErrorWithMessage(error)).toBe(false)
    })
  })
})
