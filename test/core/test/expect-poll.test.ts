import { chai, expect, test, vi } from 'vitest'

test('simple usage', async () => {
  await expect.poll(() => false).toBe(false)
  await expect.poll(() => false).not.toBe(true)
  // .resolves allowed after .poll
  await expect(Promise.resolve(1)).resolves.toBe(1)

  await expect(async () => {
    await expect.poll(() => Promise.resolve(1)).resolves.toBe(1)
  }).rejects.toThrowError('expect.poll() is not supported in combination with .resolves')
  await expect(async () => {
    await expect.poll(() => Promise.reject(new Error('empty'))).rejects.toThrowError('empty')
  }).rejects.toThrowError('expect.poll() is not supported in combination with .rejects')

  const unsupported = [
    'matchSnapshot',
    'toMatchSnapshot',
    'toMatchInlineSnapshot',
    'throws',
    'Throw',
    'throw',
    'toThrow',
    'toThrowError',
    'toThrowErrorMatchingSnapshot',
    'toThrowErrorMatchingInlineSnapshot',
  ] as const

  for (const key of unsupported) {
    await expect(async () => {
      await expect.poll(() => Promise.resolve(1))[key as 'matchSnapshot']()
    }).rejects.toThrowError(`expect.poll() is not supported in combination with .${key}(). Use vi.waitFor() if your assertion condition is unstable.`)
  }
})

test('timeout', async () => {
  await expect(async () => {
    await expect.poll(() => false, { timeout: 100, interval: 10 }).toBe(true)
  }).rejects.toThrowError(expect.objectContaining({
    message: 'Matcher did not succeed in 100ms',
    stack: expect.stringContaining('expect-poll.test.ts:38:68'),
    cause: expect.objectContaining({
      message: 'expected false to be true // Object.is equality',
    }),
  }))
})

test('interval', async () => {
  const fn = vi.fn(() => true)
  await expect(async () => {
    // using big values because CI can be slow
    await expect.poll(fn, { interval: 100, timeout: 500 }).toBe(false)
  }).rejects.toThrowError()
  // CI can be unstable, but there should be always at least 5 calls
  expect(fn.mock.calls.length >= 4).toBe(true)
})

test('fake timers don\'t break it', async () => {
  const now = Date.now()
  vi.useFakeTimers()
  await expect(async () => {
    await expect.poll(() => false, { timeout: 100 }).toBe(true)
  }).rejects.toThrowError('Matcher did not succeed in 100ms')
  vi.useRealTimers()
  const diff = Date.now() - now
  expect(diff >= 100).toBe(true)
})

test('custom matcher works correctly', async () => {
  const fn = vi.fn()
  let idx = 0
  expect.extend({
    toBeJestCompatible() {
      idx++
      fn({ poll: this.poll })
      return {
        pass: idx > 2,
        message: () => 'ok',
      }
    },
  })
  await expect.poll(() => 1, { interval: 10 }).toBeJestCompatible()
  expect(fn).toHaveBeenCalledTimes(3)
  expect(fn).toHaveBeenCalledWith({ poll: true })
})

test('toBeDefined', async () => {
  await expect.poll(() => 1).toBeDefined()
  await expect.poll(() => undefined).not.toBeDefined()

  await expect(() =>
    expect.poll(() => 1, { timeout: 100, interval: 10 }).not.toBeDefined(),
  ).rejects.toThrowError(expect.objectContaining({
    message: 'Matcher did not succeed in 100ms',
    cause: expect.objectContaining({
      message: 'expected 1 to be undefined',
    }),
  }))

  await expect(() =>
    expect.poll(() => undefined, { timeout: 100, interval: 10 }).toBeDefined(),
  ).rejects.toThrowError(expect.objectContaining({
    message: 'Matcher did not succeed in 100ms',
    cause: expect.objectContaining({
      message: 'expected undefined to be defined',
    }),
  }))
})

test('should set _isLastPollAttempt flag on last call', async () => {
  const fn = vi.fn(function (this: object) {
    return chai.util.flag(this, '_isLastPollAttempt')
  })
  await expect(async () => {
    await expect.poll(fn, { interval: 100, timeout: 500 }).toBe(false)
  }).rejects.toThrowError()
  fn.mock.results.forEach((result, index) => {
    const isLastCall = index === fn.mock.results.length - 1
    expect(result.value).toBe(isLastCall ? true : undefined)
  })
})

test('should handle success on last attempt', async () => {
  const fn = vi.fn(function (this: object) {
    if (chai.util.flag(this, '_isLastPollAttempt')) {
      return 1
    }
    return undefined
  })
  await expect.poll(fn, { interval: 100, timeout: 500 }).toBe(1)
})

test('should handle failure on last attempt', async () => {
  const fn = vi.fn(function (this: object) {
    if (chai.util.flag(this, '_isLastPollAttempt')) {
      return 3
    }
    return 2
  })
  await expect(async () => {
    await expect.poll(fn, { interval: 10, timeout: 100 }).toBe(1)
  }).rejects.toThrowError(expect.objectContaining({
    message: 'Matcher did not succeed in 100ms',
    cause: expect.objectContaining({
      // makes sure cause message reflects the last attempt value
      message: 'expected 3 to be 1 // Object.is equality',
    }),
  }))
})
