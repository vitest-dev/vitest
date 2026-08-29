import { describe, expect, test } from 'vitest'
import { runInlineTests, runVitest, ts } from '../../test-utils'

function run(testNamePattern: string) {
  return runVitest({
    include: ['fixtures/retry/retry.test.ts'],
    config: 'fixtures/retry/vitest.config.ts',
    testNamePattern,
  })
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

describe('retry with test.fails', () => {
  test('an erroring test.fails test meets its expectation and is not retried', async () => {
    const { stdout } = await runInlineTests({
      'fails-retry.test.ts': ts`
        import { expect, test } from 'vitest'
        let attempts = 0
        test.fails('meets the expectation', { retry: 2 }, () => {
          attempts++
          throw new Error('expected failure')
        })
        test('ran only once', () => {
          expect(attempts).toBe(1)
        })
      `,
    })

    expect(stdout).toContain('1 passed | 1 expected fail')
  })

  test('a passing test.fails test is retried and reported as failed', async () => {
    const { stdout, stderr } = await runInlineTests({
      'fails-retry.test.ts': ts`
        import { expect, test } from 'vitest'
        let attempts = 0
        test.fails('never meets the expectation', { retry: 2 }, () => {
          attempts++
        })
        test('ran the initial attempt and both retries', () => {
          expect(attempts).toBe(3)
        })
      `,
    })

    expect(stderr).toContain('Expect test to fail')
    expect(stdout).toContain('1 failed')
    expect(stdout).toContain('1 passed')
  })

  test('a retry condition is matched against the missing failure', async () => {
    const { stdout } = await runInlineTests({
      'fails-retry.test.ts': ts`
        import { expect, test } from 'vitest'
        let matched = 0
        test.fails('condition matches', { retry: { count: 2, condition: /Expect test to fail/ } }, () => {
          matched++
        })
        let unmatched = 0
        test.fails('condition does not match', { retry: { count: 2, condition: /something else/ } }, () => {
          unmatched++
        })
        test('only the matching one is retried', () => {
          expect([matched, unmatched]).toEqual([3, 1])
        })
      `,
    })

    expect(stdout).toContain('1 passed')
  })
})
