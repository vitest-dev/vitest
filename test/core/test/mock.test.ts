import { spy, describe, it, expect, assert } from 'vitest'

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

    fn('World', 2)
    fn('Hi', 1)

    expect(fn.lastCall.args).toEqual(['Hi', 1])

    expect(fn).toHaveBeenNthCalledWith(1, 'World', 2)
    expect(fn).toHaveBeenNthCalledWith(2, 'Hi', 1)
    expect(fn).toHaveBeenLastCalledWith('Hi', 1)
    expect(fn).toHaveBeenCalledWith('Hi', 1)
  })

  it('returns', () => {
    let i = 0

    const fn = spy(() => String(++i))

    expect(fn).not.toHaveReturned()

    fn()

    expect(fn).toHaveReturned()
    expect(fn).toHaveReturnedTimes(1)
    expect(fn).toHaveReturnedWith('1')

    fn()
    fn()

    expect(fn).toHaveReturnedTimes(3)
    expect(fn).toHaveNthReturnedWith(2, '2')
    expect(fn).toHaveLastReturnedWith('3')
  })

  it('throws', () => {
    let i = 0

    const fn = spy(() => {
      if (i === 1) {
        ++i
        throw new Error('error')
      }

      return String(++i)
    })

    fn()
    try {
      fn()
    }
    catch {}
    fn()

    try {
      expect(fn).toHaveNthReturnedWith(2, '2')
      assert.fail('expect should throw, since 2nd call is thrown')
    }
    catch {}

    // not throws
    expect(fn).not.toHaveNthReturnedWith(2, '2')

    expect(fn).toHaveReturnedTimes(2)
    expect(fn).toHaveNthReturnedWith(3, '3')
  })
})
