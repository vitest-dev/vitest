import { spy, describe, it, expect } from 'vitest'

describe('mock', () => {
  it('basic', () => {
    const fn = spy()

    expect(fn).not.toHaveBeenCalled()

    fn()

    expect(fn).toHaveBeenCalled()
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledTimes(1)

    fn.resetHistory()

    expect(fn).not.toHaveBeenCalled()

    fn('Hi', 1)

    expect(fn.lastCall.args).toEqual(['Hi', 1])

    expect(fn).toHaveBeenCalledWith('Hi', 1)
  })
})
