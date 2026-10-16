import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

const testFile = `
import { createRequire } from 'node:module'
import { setTimeout as nodeSetTimeout } from 'node:timers'
import timers from 'node:timers'
import { setTimeout as sleep } from 'node:timers/promises'
import { afterEach, expect, test, vi } from 'vitest'

const require = createRequire(import.meta.url)
const requiredTimers = require('node:timers')

afterEach(() => {
  vi.useRealTimers()
})

test('node:timers is not faked by default', () => {
  vi.useFakeTimers()
  nodeSetTimeout(() => {}, 0)
  timers.setTimeout(() => {}, 0)
  expect(vi.getTimerCount()).toBe(0)
})

test('fakes node:timers', () => {
  vi.useFakeTimers({ fakeNodeBuiltins: true })
  const callback = vi.fn()
  nodeSetTimeout(callback, 1000)
  timers.setTimeout(callback, 1000)
  requiredTimers.setTimeout(callback, 1000)
  expect(vi.getTimerCount()).toBe(3)
  vi.advanceTimersByTime(1000)
  expect(callback).toHaveBeenCalledTimes(3)
})

test('fakes node:timers/promises', async () => {
  vi.useFakeTimers({ fakeNodeBuiltins: true })
  let resolved = false
  const promise = sleep(1000).then(() => {
    resolved = true
  })
  await vi.advanceTimersByTimeAsync(999)
  expect(resolved).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await promise
  expect(resolved).toBe(true)
})

test('useRealTimers restores the modules', async () => {
  vi.useFakeTimers({ fakeNodeBuiltins: true })
  vi.useRealTimers()
  await new Promise(resolve => nodeSetTimeout(resolve, 1))
  await sleep(1)
})
`

test.for(['threads', 'forks', 'vmThreads', 'vmForks'] as const)(
  '%s fakes node:timers with fakeNodeBuiltins',
  async (pool) => {
    const { stderr, testTree } = await runInlineTests({ 'timers.test.js': testFile }, { pool })

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "timers.test.js": {
          "fakes node:timers": "passed",
          "fakes node:timers/promises": "passed",
          "node:timers is not faked by default": "passed",
          "useRealTimers restores the modules": "passed",
        },
      }
    `)
  },
)

test('fakeNodeBuiltins can be enabled in the config', async () => {
  const { stderr, testTree } = await runInlineTests(
    {
      'timers.test.js': `
        import { setTimeout as sleep } from 'node:timers/promises'
        import { expect, test, vi } from 'vitest'

        test('node:timers/promises is faked', () => {
          vi.useFakeTimers()
          sleep(1000)
          expect(vi.getTimerCount()).toBe(1)
          vi.useRealTimers()
        })
      `,
    },
    { fakeTimers: { fakeNodeBuiltins: true } },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "timers.test.js": {
        "node:timers/promises is faked": "passed",
      },
    }
  `)
})
