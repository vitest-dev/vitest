import { describe, expect, test, vi } from 'vitest'

describe('waitFor', () => {
  describe('options', () => {
    test('timeout', async () => {
      await expect(async () => {
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
          timeout: 60,
          interval: 30,
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: interval error]`)

      expect(callback).toHaveBeenCalledTimes(2)
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
      if (finished) {
        return Promise.resolve(true)
      }
      else {
        return Promise.reject(new Error('async function error'))
      }
    })
  })

  test('stacktrace correctly', async () => {
    const check = () => {
      throw new Error('Fail.')
    }
    try {
      await vi.waitFor(check, 100)
    }
    catch (error) {
      expect((error as Error).message).toMatchInlineSnapshot('"Fail."')
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
      expect((error as Error).stack?.split('\n')[1]).toMatch(/waitFor\s*\(.*/)
    }
  })

  test('fakeTimer works', async () => {
    setTimeout(() => {
      vi.advanceTimersByTime(200)
    }, 50)

    vi.useFakeTimers()

    await vi.waitFor(() => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve()
        }, 150)
      })
    }, 200)

    vi.useRealTimers()
  })

  test('callback stops running after timeout', async () => {
    let timedOut = false
    let callbackRanAfterTimeout = false
    try {
      await vi.waitFor(() => {
        callbackRanAfterTimeout = timedOut
        throw new Error('waitFor error')
      }, {
        interval: 10,
        timeout: 50,
      })
    }
    catch {
      timedOut = true
    }
    expect(timedOut).toBe(true)
    expect(callbackRanAfterTimeout).toBe(false)
  })
})

describe('waitUntil', () => {
  describe('options', () => {
    test('timeout', async () => {
      await expect(async () => {
        await vi.waitUntil(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(true)
            }, 100)
          })
        }, 50)
      }).rejects.toThrow('Timed out in waitUntil!')
    })

    test('interval', async () => {
      const callback = vi.fn(() => {
        return false
      })

      await expect(
        vi.waitUntil(callback, {
          timeout: 1000,
          interval: 600,
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Timed out in waitUntil!]`)

      expect(callback).toHaveBeenCalledTimes(2)
    })
  })

  test('basic', async () => {
    let result = true
    await vi.waitUntil(() => {
      result = !result
      return result
    })
    expect(result).toBe(true)
  })

  test('async function', async () => {
    let finished = false
    setTimeout(() => {
      finished = true
    }, 50)
    await vi.waitUntil(async () => {
      return Promise.resolve(finished)
    })
  })

  test('stacktrace correctly when callback throw error', async () => {
    const check = () => {
      throw new Error('Fail.')
    }
    try {
      await vi.waitUntil(check, 20)
    }
    catch (error) {
      expect((error as Error).message).toMatchInlineSnapshot('"Fail."')
      expect.soft((error as Error).stack).toMatch(/at check/)
    }
  })

  test('fakeTimer works', async () => {
    setTimeout(() => {
      vi.advanceTimersByTime(200)
    }, 50)

    vi.useFakeTimers()

    await vi.waitUntil(() => {
      return new Promise<boolean>((resolve) => {
        setTimeout(() => {
          resolve(true)
        }, 150)
      })
    }, 200)

    vi.useRealTimers()
  })

  test('callback stops running after timeout', async () => {
    let timedOut = false
    let callbackRanAfterTimeout = false
    try {
      await vi.waitUntil(() => {
        callbackRanAfterTimeout = timedOut
        return false
      }, {
        interval: 10,
        timeout: 50,
      })
    }
    catch {
      timedOut = true
    }
    expect(timedOut).toBe(true)
    expect(callbackRanAfterTimeout).toBe(false)
  })
})
