import type { TestBenchmark } from 'vitest'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// keep runs tiny — this suite asserts wiring, not measurement accuracy
const fastBenchOptions = {
  time: 0,
  iterations: 2,
  warmupTime: 0,
  warmupIterations: 0,
}

test('bench.compare records benchmark results for each registration', async () => {
  const benchmarks: TestBenchmark[] = []

  const { stderr } = await runInlineTests(
    {
      'basic.bench.ts': /* ts */`
        import { test, inject } from 'vitest'

        test('compare loops', async ({ bench }) => {
          await bench.compare(
            bench('for', () => { let x = 0; for (let i = 0; i < 10; i++) x += i }),
            bench('while', () => { let x = 0, i = 0; while (i < 10) { x += i; i++ } }),
            inject('options'),
          )
        })
`,
    },
    {
      benchmark: { enabled: true },
      reporters: [
        {
          onTestCaseBenchmark(_testCase, benchmark) {
            benchmarks.push(benchmark)
          },
        },
      ],
      provide: {
        options: fastBenchOptions,
      },
    },
  )

  expect(stderr).toBe('')
  expect(benchmarks).toHaveLength(1)
  const [{ tasks }] = benchmarks
  expect(tasks.map(t => t.name).sort()).toEqual(['for', 'while'])
  expect(tasks.every(t => typeof t.latency.mean === 'number')).toBe(true)
  expect(tasks.map(t => t.rank).sort()).toEqual([1, 2])
})

test('bench accepts options as second argument and rejects them as third', async () => {
  const { stderr, results } = await runInlineTests(
    {
      'sig.bench.ts': /* ts */`
        import { test, expect } from 'vitest'

        test('bench signatures', ({ bench }) => {
          const fn = () => 1
          const opts = { async: false }

          // options as the 2nd argument (preferred form, matches test())
          const withOpts = bench('with-opts', opts, fn)
          expect(withOpts.name).toBe('with-opts')
          expect(withOpts.fn).toBe(fn)
          expect(withOpts.fnOpts).toBe(opts)

          // simplest form — no options
          const noOpts = bench('no-opts', fn)
          expect(noOpts.fn).toBe(fn)
          expect(noOpts.fnOpts).toBeUndefined()

          // legacy (fn, options) form must throw
          expect(() => bench('legacy', fn, opts)).toThrow(/third argument/)
        })
`,
    },
    { benchmark: { enabled: true } },
  )

  expect(stderr).toBe('')
  const testCases = [...(results[0]?.children.allTests() ?? [])]
  expect(testCases).toHaveLength(1)
  expect(testCases[0].result()?.state).toBe('passed')
})

declare module 'vitest' {
  interface ProvidedContext {
    options: typeof fastBenchOptions
  }
}
