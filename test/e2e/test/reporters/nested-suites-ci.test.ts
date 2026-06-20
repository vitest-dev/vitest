import { runInlineTests } from '#test-utils'
import { expect, test } from 'vitest'
import { trimReporterOutput } from './utils'

const fastBenchOptions = { time: 0, iterations: 2, warmupTime: 0, warmupIterations: 0 }

// https://github.com/vitest-dev/vitest/issues/10606
// When `renderSucceed` is disabled (e.g. in CI), a slow test or a test with
// inline benchmarks is still printed, so its parent suites must be printed too
// to keep the nesting correct instead of leaving the test orphaned.

test('prints parent suites for slow tests when renderSucceed is disabled', async () => {
  const { stdout, stderr } = await runInlineTests(
    {
      'slow.test.ts': /* ts */`
        import { describe, test } from 'vitest'
        describe('outer suite', () => {
          describe('inner suite', () => {
            test('slow nested test', async () => {
              await new Promise(resolve => setTimeout(resolve, 500))
            })
          })
        })
      `,
    },
    {
      reporters: [['default', { isTTY: false, summary: false }]],
      slowTestThreshold: 100,
    },
  )

  expect(stderr).toBe('')
  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "✓ slow.test.ts (1 test) [...]ms
       ✓ outer suite (1)
         ✓ inner suite (1)
           ✓ slow nested test [...]ms"
  `)
})

test('prints parent suites for inline benchmarks when renderSucceed is disabled', async () => {
  const { stdout, stderr } = await runInlineTests(
    {
      'suite.bench.ts': /* ts */`
        import { describe, test, inject } from 'vitest'
        describe('my first suite', () => {
          test('foo', async ({ bench }) => {
            await bench('foo', () => { let x = 0; for (let i = 0; i < 10; i++) x += i }).run(inject('options'))
          })
        })
        describe('my second suite', () => {
          test('foo', async ({ bench }) => {
            await bench('foo', () => { let x = 0; for (let i = 0; i < 10; i++) x += i }).run(inject('options'))
          })
        })
      `,
    },
    {
      benchmark: { enabled: true },
      reporters: [['default', { isTTY: false, summary: false }]],
      provide: { options: fastBenchOptions },
    },
  )

  expect(stderr).toBe('')

  // benchmark table rows carry measurement noise, so keep only the tree lines
  // to assert each suite label is printed with its bench nested underneath
  const tree = trimReporterOutput(stdout)
    .split('\n')
    .filter(line => /[✓❯×↓]/.test(line))
    .join('\n')
  expect(tree).toMatchInlineSnapshot(`
    "✓ |bench| suite.bench.ts (2 tests) [...]ms
       ✓ my first suite (1)
         ✓ foo [...]ms
       ✓ my second suite (1)
         ✓ foo [...]ms"
  `)
})
