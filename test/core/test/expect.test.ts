import { resolve } from 'node:path'
import type { UserConfig } from 'vitest'
import { describe, expect, expectTypeOf, test } from 'vitest'
import { getCurrentTest } from '@vitest/runner'
import { runVitest } from '../../test-utils'

describe('expect.soft', () => {
  const run = (config?: UserConfig) => runVitest({ root: resolve(__dirname, './fixtures/expects'), exclude: [], setupFiles: [], testNamePattern: getCurrentTest()?.name, testTimeout: 4000, ...config }, ['soft'])

  test('types', () => {
    expectTypeOf(expect).toEqualTypeOf(expect)
    expectTypeOf(expect.soft(7)).toEqualTypeOf(expect(7))
    expectTypeOf(expect.soft(5)).toHaveProperty('toBe')
    expectTypeOf(expect.soft(7)).not.toHaveProperty('toCustom')
  })

  test('basic', async () => {
    const { stderr } = await run()
    expect(stderr).toContain('AssertionError: expected 1 to be 2')
    expect(stderr).toContain('AssertionError: expected 2 to be 3')
  })

  test('promise', async () => {
    const { stderr } = await run()
    expect(stderr).toContain('AssertionError: expected 2 to be 3')
    expect(stderr).toContain('AssertionError: expected 1 to be 2')
  })

  test('with expect', async () => {
    const { stderr } = await run()
    expect(stderr).toContain('AssertionError: expected 1 to deeply equal 2')
    expect(stderr).toContain('AssertionError: expected 10 to deeply equal 20')
    expect(stderr).not.toContain('AssertionError: expected 2 to deeply equal 3')
  })

  test('with expect.extend', async () => {
    const { stderr } = await run()
    expect(stderr).toContain('AssertionError: expected 1 to deeply equal 2')
    expect(stderr).toContain('Error: expected 3 to be divisible by 4')
    expect(stderr).toContain('AssertionError: expected 5 to deeply equal 6')
  })

  test('passed', async () => {
    const { stdout } = await run()
    expect(stdout).toContain('✓ soft.test.ts > passed')
  })

  test('retry will passed', async () => {
    const { stdout } = await run()
    expect(stdout).toContain('✓ soft.test.ts > retry will passed')
  })

  test('retry will failed', async () => {
    const { stderr } = await run()
    expect(stderr).toContain('AssertionError: expected 1 to be 4')
    expect(stderr).toContain('AssertionError: expected 2 to be 5')
    expect(stderr).toContain('AssertionError: expected 3 to be 4')
    expect(stderr).toContain('AssertionError: expected 4 to be 5')
    expect(stderr).toContain('4/4')
  })

  test('using expect.soft for test', async () => {
    const { stderr } = await run({
      testNamePattern: 'retry will failed',
    })
    expect.soft(stderr).toContain('AssertionError: expected 1 to be 4')
    expect.soft(stderr).toContain('AssertionError: expected 2 to be 5')
    expect.soft(stderr).toContain('AssertionError: expected 3 to be 4')
    expect.soft(stderr).toContain('AssertionError: expected 4 to be 5')
    expect.soft(stderr).toContain('4/4')
  })
}, 4000)
