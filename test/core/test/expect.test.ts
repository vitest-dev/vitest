import type { UserConfig } from 'vitest'
import { describe, expect, test } from 'vitest'
import { getCurrentTest } from '@vitest/runner'
import { runVitest } from '../../test-utils'

describe('expect.soft', () => {
  const run = (config?: UserConfig) => runVitest({ root: './test/fixtures/expects', exclude: [], setupFiles: [], testNamePattern: getCurrentTest()?.name, ...config }, ['soft'])
  test('basic', async () => {
    const { stderr } = await run()
    expect(stderr).toContain('AssertionError: expected 1 to be 2')
    expect(stderr).toContain('AssertionError: expected 2 to be 3')
    expect(stderr).toMatchSnapshot()
  })

  test('promise', async () => {
    const { stderr } = await run()
    expect(stderr).toContain('AssertionError: expected 2 to be 3')
    expect(stderr).toContain('AssertionError: expected 1 to be 2')
    expect(stderr).toMatchSnapshot()
  })

  test('expect with expect.soft', async () => {
    const { stderr } = await run()
    expect(stderr).toContain('AssertionError: expected 1 to deeply equal 2')
    expect(stderr).toContain('AssertionError: expected 10 to deeply equal 20')
    expect(stderr).not.toContain('AssertionError: expected 2 to deeply equal 3')
    expect(stderr).toMatchSnapshot()
  })

  test('expect with expect.soft', async () => {
    const { stderr } = await run()
    expect(stderr).toContain('AssertionError: expected 1 to deeply equal 2')
    expect(stderr).toContain('AssertionError: expected 10 to deeply equal 20')
    expect(stderr).not.toContain('AssertionError: expected 2 to deeply equal 3')
    expect(stderr).toMatchSnapshot()
  })

  test('expect.soft with expect.extend', async () => {
    const { stderr } = await run()
    expect(stderr).toContain('AssertionError: expected 1 to deeply equal 2')
    expect(stderr).toContain('expected 3 to be square')
    expect(stderr).toContain('AssertionError: expected 5 to deeply equal 6')
    expect(stderr).toMatchSnapshot()
  })

  test('expect.soft successfully', async () => {
    const { stdout } = await run()
    expect(stdout).toContain('1 passed')
  })
})
