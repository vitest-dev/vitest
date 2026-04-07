import { describe, expect, test } from 'vitest'
import { runVitest, StableTestFileOrderSorter } from '../../test-utils'

// Test to detect that there are no unexpected logs, like NodeJS MaxListenersExceededWarning

describe.each(['forks', 'threads', 'vmForks', 'vmThreads'] as const)('%s', (pool) => {
  test.each([true, false])(`should not log anything unexpected { isolate: %s }`, async (isolate) => {
    const { stdout, stderr } = await runVitest({
      root: './fixtures/no-unexpected-logging',
      pool,
      isolate,
      sequence: { sequencer: StableTestFileOrderSorter },
    })

    expect(stderr).toBe('')

    expect(normalizeOutput(stdout)).toBe(`
 RUN  v[...]

 ✓ fixture-1.test.ts > test 1 [...]ms
 ✓ fixture-10.test.ts > test 10 [...]ms
 ✓ fixture-11.test.ts > test 11 [...]ms
 ✓ fixture-12.test.ts > test 12 [...]ms
 ✓ fixture-2.test.ts > test 2 [...]ms
 ✓ fixture-3.test.ts > test 3 [...]ms
 ✓ fixture-4.test.ts > test 4 [...]ms
 ✓ fixture-5.test.ts > test 5 [...]ms
 ✓ fixture-6.test.ts > test 6 [...]ms
 ✓ fixture-7.test.ts > test 7 [...]ms
 ✓ fixture-8.test.ts > test 8 [...]ms
 ✓ fixture-9.test.ts > test 9 [...]ms

 Test Files  12 passed (12)
      Tests  12 passed (12)
   Start at  [...]
   Duration  [...]ms (transform [...]ms, setup [...]ms, import [...]ms, tests [...]ms, environment [...]ms)

   `.trim())
  })
})

function normalizeOutput(stdtout: string) {
  const rows = stdtout.replace(/\d?\.?\d+m?s/g, '[...]ms').split('\n').map((row) => {
    if (row.includes('RUN  v')) {
      return `${row.split('RUN  v')[0]}RUN  v[...]`
    }

    if (row.includes('Start at')) {
      return row.replace(/\d+:\d+:\d+/, '[...]')
    }
    return row
  })

  return rows.join('\n').trim()
}
