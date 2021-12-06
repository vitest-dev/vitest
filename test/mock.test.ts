import { spy, describe, it, expect } from 'vitest'

describe('mock', () => {
  it('basic', () => {
    const fn = spy()

    expect(fn).not.toHaveBeenCalled()

    fn()

    expect(fn).toHaveBeenCalled()
    expect(fn).toBeCalledOnce()
    expect(fn).toBeCalledTimes(1)

    fn.resetHistory()

    expect(fn).not.toHaveBeenCalled()

    fn('Hi')

    expect(fn.lastCall.args).toEqual(['Hi'])
  })
})
