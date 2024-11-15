import { sleep } from '../../../src/logic/time'

describe('when sleeping', () => {
  let sleeping: Promise<unknown>
  beforeEach(() => {
    jest.useFakeTimers()
    sleeping = sleep(30000)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should return a promise that resolves after the specified time', () => {
    jest.advanceTimersByTime(30000)
    return expect(sleeping).resolves.toBeUndefined()
  })
})
