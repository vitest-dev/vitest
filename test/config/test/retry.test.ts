import { describe, expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

function run(testNamePattern: string) {
  return runVitestCli('run', 'fixtures/retry/retry.test.ts', '-c', 'fixtures/retry/vitest.config.ts', '-t', testNamePattern)
}

describe('retry', () => {
  test('should passed', async () => {
    const { stdout } = await run('should passed')
    expect(stdout).toContain('1 passed')
  })

  test('retry but still failed', async () => {
    const { stdout } = await run('retry but still failed')
    expect(stdout).toContain('expected 1 to be 4')
    expect(stdout).toContain('expected 2 to be 4')
    expect(stdout).toContain('expected 3 to be 4')
    expect(stdout).toContain('1 failed')
  })
})
