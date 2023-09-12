import { getSafeTimers } from '@vitest/utils'
import { describe, expect, test, vi } from 'vitest'

describe('waitFor', () => {
  describe('options', () => {
    test('timeout', async () => {
      expect(async () => {
        await vi.waitFor(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(true)
            }, 100)
          })
        }, 50)
      }).rejects.toThrow('Timed out in waitFor!')
    })

    test('interval', async () => {
      const callback = vi.fn(() => {
        throw new Error('interval error')
      })

      await expect(
        vi.waitFor(callback, {
          timeout: 45,
          interval: 10,
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot('"interval error"')

      expect(callback).toHaveBeenCalledTimes(5)
    })
  })

  test('basic', async () => {
    let throwError = false
    await vi.waitFor(() => {
      if (!throwError) {
        throwError = true
        throw new Error('basic error')
      }
    })
    expect(throwError).toBe(true)
  })

  test('async function', async () => {
    let finished = false
    setTimeout(() => {
      finished = true
    }, 50)
    await vi.waitFor(async () => {
      if (finished)
        return Promise.resolve(true)
      else
        return Promise.reject(new Error('async function error'))
    })
  })

  test('stacktrace correctly', async () => {
    const check = () => {
      const _a = 1
      // @ts-expect-error test
      _a += 1
    }
    try {
      await vi.waitFor(check, 100)
    }
    catch (error) {
      expect((error as Error).message).toMatchInlineSnapshot('"Assignment to constant variable."')
      expect.soft((error as Error).stack).toMatch(/at check/)
    }
  })

  test('stacktrace point to waitFor', async () => {
    const check = async () => {
      return new Promise((resolve) => {
        setTimeout(resolve, 60)
      })
    }
    try {
      await vi.waitFor(check, 50)
    }
    catch (error) {
      expect(error).toMatchInlineSnapshot('[Error: Timed out in waitFor!]')
      expect((error as Error).stack?.split('\n')[1]).toMatch(/waitFor\s*\(.*\)?/)
    }
  })

  test('fakeTimer works', async () => {
    vi.useFakeTimers()

    const { setTimeout: safeSetTimeout } = getSafeTimers()

    safeSetTimeout(() => {
      vi.advanceTimersByTime(200)
    }, 50)

    await vi.waitFor(() => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve()
        }, 150)
      })
    }, 50)

    vi.useRealTimers()
  })
})
