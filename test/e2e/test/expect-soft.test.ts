import type { TestUserConfig } from 'vitest/node'
import { resolve } from 'node:path'
import { describe, expect, test, TestRunner } from 'vitest'
import { runInlineTests, runVitest } from '../../test-utils'

describe('expect.soft', () => {
  const run = (config?: TestUserConfig) =>
    runVitest(
      {
        root: resolve('./fixtures/expect-soft'),
        include: ['expects/soft.test.ts'],
        setupFiles: [],
        testNamePattern: TestRunner.getCurrentTest()?.name,
        testTimeout: 4000,
        ...config,
      },
      ['soft'],
    )

  test('basic', async () => {
    const { stderr } = await run()
    expect.soft(stderr).toContain('AssertionError: expected 1 to be 2')
    expect.soft(stderr).toContain('AssertionError: expected 2 to be 3')
  })

  test('promise', async () => {
    const { stderr } = await run()
    expect.soft(stderr).toContain('AssertionError: expected 2 to be 3')
    expect.soft(stderr).toContain('AssertionError: expected 1 to be 2')
  })

  test('with expect', async () => {
    const { stderr } = await run()
    expect.soft(stderr).toContain('AssertionError: expected 1 to deeply equal 2')
    expect.soft(stderr).toContain('AssertionError: expected 10 to deeply equal 20')
    expect.soft(stderr).not.toContain('AssertionError: expected 2 to deeply equal 3')
  })

  test('with expect.extend', async () => {
    const { stderr } = await run()
    expect.soft(stderr).toContain('AssertionError: expected 1 to deeply equal 2')
    expect.soft(stderr).toContain('Error: expected 3 to be divisible by 4')
    expect.soft(stderr).toContain('AssertionError: expected 5 to deeply equal 6')
  })

  test('promise with expect.extend', async () => {
    const { stderr } = await run()
    expect.soft(stderr).toContain('Error: expected 2 to be 3')
    expect.soft(stderr).toContain('Error: expected 4 to be 3')
  })

  test('promise rejection', async () => {
    const { stderr } = await run()
    // both assertions should execute (not abort after first rejection)
    expect.soft(stderr).toContain('promise rejected "Error: boom 1st" instead of resolving')
    expect.soft(stderr).toContain('promise rejected "Error: boom 2nd" instead of resolving')
  })

  test('promise resolved instead of rejecting', async () => {
    const { stderr } = await run()
    // both assertions should execute
    expect.soft(stderr).toContain('promise resolved "\'value 1\'" instead of rejecting')
    expect.soft(stderr).toContain('promise resolved "\'value 2\'" instead of rejecting')
  })

  test('passed', async () => {
    const { stdout } = await run()
    expect.soft(stdout).toContain('soft.test.ts > passed')
  })

  test('retry will passed', async () => {
    const { stdout } = await run()
    expect.soft(stdout).toContain('soft.test.ts > retry will passed')
  })

  test('retry will failed', async () => {
    const { stderr } = await run()
    expect.soft(stderr).toContain('AssertionError: expected 1 to be 4')
    expect.soft(stderr).toContain('AssertionError: expected 2 to be 5')
    expect.soft(stderr).toContain('AssertionError: expected 3 to be 4')
    expect.soft(stderr).toContain('AssertionError: expected 4 to be 5')
    expect.soft(stderr).toContain('4/4')
  })
})

test('expect.soft with .resolves and .rejects reports the assertion location', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      'basic.test.ts': `
import { expect, test } from 'vitest'

expect.extend({
  toBeOld(received) {
    return { pass: received === 'old', message: () => 'expected ' + received + ' to be old' }
  },
})

test('resolves', async () => {
  await expect.soft(Promise.resolve('new')).resolves.toBe('old')
  await expect.soft(Promise.resolve('new')).resolves.toBeOld()
})

test('rejects', async () => {
  await expect.soft(Promise.reject(new Error('new'))).rejects.toThrow('old')
  await expect.soft(Promise.reject(new Error('new'))).rejects.toMatchInlineSnapshot(\`[Error: old]\`)
  await expect.soft(Promise.reject(new Error('new'))).rejects.toMatchFileSnapshot('./old.txt')
})
`,
      'old.txt': 'old',
    },
    { update: 'none' },
  )
  expect(stderr).not.toBe('')
  expect(errorTree({ stackTrace: true })).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "rejects": [
          "expected [Function] to throw error including 'old' but got 'new'
        at basic.test.ts:16:54",
          "Snapshot \`rejects 1\` mismatched
        at basic.test.ts:17:54",
          "Snapshot \`rejects 2\` mismatched
        at basic.test.ts:18:54",
        ],
        "resolves": [
          "expected 'new' to be 'old' // Object.is equality
        at basic.test.ts:11:44",
          "expected new to be old
        at basic.test.ts:12:44",
        ],
      },
    }
  `)
})
