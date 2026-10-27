import { join } from 'pathe'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '#test-utils'

const files = {
  'setup.ts': `await new Promise(resolve => setTimeout(resolve, 10))`,
  'example.test.ts': `
    import { beforeEach, expect, test, vi } from 'vitest'
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    test('runs user code and waits', async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(1 + 1).toBe(2)
    })
    test('supports fake timers', () => {
      vi.useFakeTimers()
      try {
        let called = false
        setTimeout(() => { called = true }, 1000)
        vi.runAllTimers()
        expect(called).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })
  `,
}

function summaryLines(stdout: string) {
  return stdout
    .split('\n')
    .filter((line) => /^\s*(Duration|Timings)\s/.test(line))
    .map((line) => line.trim())
}

function normalizeSummary(line: string) {
  return line.replace(/[\d.]+(?:ms|s)/g, '<time>').replace(/[<>]?\d+%/g, '<share>')
}

test.each(['forks', 'threads', 'vmForks', 'vmThreads'] as const)(
  'prints the compact split with the %s pool',
  async (pool) => {
    const { stdout, stderr, testTree } = await runInlineTests(files, {
      pool,
      reporters: ['default'],
      setupFiles: ['./setup.ts'],
      experimental: { diagnostics: false },
    })

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "example.test.ts": {
          "runs user code and waits": "passed",
          "supports fake timers": "passed",
        },
      }
    `)
    expect(summaryLines(stdout).map(normalizeSummary)).toMatchInlineSnapshot(`
      [
        "Duration  <time> (user code <share>, Vitest <share>)",
      ]
    `)
  },
)

test.each(['verbose', 'tree'] as const)(
  'prints phase durations with the %s reporter',
  async (reporter) => {
    const { stdout, stderr } = await runInlineTests(files, {
      reporters: [reporter],
      setupFiles: ['./setup.ts'],
      experimental: { diagnostics: false },
    })

    expect(stderr).toBe('')
    const [summary, timings] = summaryLines(stdout)
    expect(normalizeSummary(summary)).toMatchInlineSnapshot(
      `"Duration  <time> (user code <share>, Vitest <share>)"`,
    )
    expect(timings).toMatch(/^Timings\s+(?:[a-z]+ [\d.]+(?:ms|s) \(\d+%\)(?:, )?)+$/)
    expect(timings).toMatch(/tests [\d.]+(?:ms|s) \(\d+%\)/)
  },
)

test('prints a compact split when merging blob reports', async () => {
  const { root, stderr: runErrors } = await runInlineTests(files, {
    reporters: ['blob'],
    setupFiles: ['./setup.ts'],
  })
  expect(runErrors).toBe('')

  const { stdout, stderr } = await runVitest({
    root,
    mergeReports: join(root, '.vitest/blob'),
    reporters: ['default'],
    experimental: { diagnostics: false },
  })

  expect(stderr).toBe('')
  expect(summaryLines(stdout).map(normalizeSummary)).toMatchInlineSnapshot(`
    [
      "Duration  <time> (user code <share>, Vitest <share>)",
    ]
  `)
})
