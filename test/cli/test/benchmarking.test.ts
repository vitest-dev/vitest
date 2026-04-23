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

declare module 'vitest' {
  interface ProvidedContext {
    options: typeof fastBenchOptions
  }
}
