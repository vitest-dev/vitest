import type { UserConfig } from 'vitest'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { getCurrentTest } from 'vitest/suite'
import { runVitest } from '../../test-utils'

describe('expect.soft', () => {
  const run = (config?: UserConfig) => runVitest({
    root: resolve('./fixtures/expect-soft'),
    include: ['expects/soft.test.ts'],
    setupFiles: [],
    testNamePattern: getCurrentTest()?.name,
    testTimeout: 4000,
    ...config,
  }, ['soft'])

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
