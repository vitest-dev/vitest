import type { TestSpecification } from 'vitest/node'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('duration', async () => {
  const { stdout } = await runVitest({
    root: 'fixtures/duration',
    reporters: 'verbose',
    env: { CI: '1' },
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "✓ basic.test.ts > fast [...]ms
     ✓ basic.test.ts > slow [...]ms"
  `)
})

test('prints error properties', async () => {
  const result = await runVitest({
    root: 'fixtures/error-props',
    reporters: 'verbose',
    env: { CI: '1' },
  })

  expect(result.stderr).toContain(`Serialized Error: { code: 404, status: 'not found' }`)
})

test('prints skipped tests by default', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/pass-and-skip-test-suites.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    config: false,
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "✓ fixtures/pass-and-skip-test-suites.test.ts (4 tests | 2 skipped) [...]ms
       ✓ passing test #1 [...]ms
       ✓ passing suite (1)
         ✓ passing test #2 [...]ms
       ↓ skipped test #1
       ↓ skipped suite (1)
         ↓ skipped test #2"
  `)
})

test('hides skipped tests when --hideSkippedTests', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/pass-and-skip-test-suites.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    hideSkippedTests: true,
    config: false,
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "✓ fixtures/pass-and-skip-test-suites.test.ts (4 tests | 2 skipped) [...]ms
       ✓ passing test #1 [...]ms
       ✓ passing suite (1)
         ✓ passing test #2 [...]ms"
  `)
})

test('prints retry count', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/retry.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    retry: 3,
    config: false,
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "✓ fixtures/retry.test.ts (1 test) [...]ms
       ✓ pass after retries [...]ms (retry x3)"
  `)
})

test('prints repeat count', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/repeats.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    config: false,
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "✓ fixtures/repeats.test.ts (1 test) [...]ms
       ✓ repeat couple of times [...]ms (repeat x3)"
  `)
})

test('renders tree when in TTY', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/verbose/*.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    config: false,
    fileParallelism: false,
    sequence: {
      sequencer: class StableTestFileOrderSorter {
        sort(files: TestSpecification[]) {
          return files.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
        }

        shard(files: TestSpecification[]) {
          return files
        }
      },
    },
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "❯ fixtures/verbose/example-1.test.ts (10 tests | 1 failed | 4 skipped) [...]ms
       ✓ test pass in root [...]ms
       ↓ test skip in root
       ❯ suite in root (5)
         ✓ test pass in 1. suite #1 [...]ms
         ✓ test pass in 1. suite #2 [...]ms
         ❯ suite in suite (3)
           ✓ test pass in nested suite #1 [...]ms
           ✓ test pass in nested suite #2 [...]ms
           ❯ suite in nested suite (1)
             × test failure in 2x nested suite [...]ms
       ↓ suite skip in root (3)
         ↓ test 1.3
         ↓ suite in suite (2)
           ↓ test in nested suite
           ↓ test failure in nested suite of skipped suite
     ✓ fixtures/verbose/example-2.test.ts (3 tests | 1 skipped) [...]ms
       ✓ test 0.1 [...]ms
       ↓ test 0.2
       ✓ suite 1.1 (1)
         ✓ test 1.1 [...]ms"
  `)
})

test('does not render tree when in non-TTY', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/verbose/*.test.ts'],
    reporters: [['verbose', { isTTY: false, summary: false }]],
    config: false,
    fileParallelism: false,
    sequence: {
      sequencer: class StableTestFileOrderSorter {
        sort(files: TestSpecification[]) {
          return files.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
        }

        shard(files: TestSpecification[]) {
          return files
        }
      },
    },
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "✓ fixtures/verbose/example-1.test.ts > test pass in root [...]ms
     ↓ fixtures/verbose/example-1.test.ts > test skip in root
     ✓ fixtures/verbose/example-1.test.ts > suite in root > test pass in 1. suite #1 [...]ms
     ✓ fixtures/verbose/example-1.test.ts > suite in root > test pass in 1. suite #2 [...]ms
     ✓ fixtures/verbose/example-1.test.ts > suite in root > suite in suite > test pass in nested suite #1 [...]ms
     ✓ fixtures/verbose/example-1.test.ts > suite in root > suite in suite > test pass in nested suite #2 [...]ms
     × fixtures/verbose/example-1.test.ts > suite in root > suite in suite > suite in nested suite > test failure in 2x nested suite [...]ms
       → expected 'should fail' to be 'as expected' // Object.is equality
     ↓ fixtures/verbose/example-1.test.ts > suite skip in root > test 1.3
     ↓ fixtures/verbose/example-1.test.ts > suite skip in root > suite in suite > test in nested suite
     ↓ fixtures/verbose/example-1.test.ts > suite skip in root > suite in suite > test failure in nested suite of skipped suite
     ✓ fixtures/verbose/example-2.test.ts > test 0.1 [...]ms
     ↓ fixtures/verbose/example-2.test.ts > test 0.2
     ✓ fixtures/verbose/example-2.test.ts > suite 1.1 > test 1.1 [...]ms"
  `)
})

test('hides skipped tests when --hideSkippedTests and in non-TTY', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/verbose/*.test.ts'],
    reporters: [['verbose', { isTTY: false, summary: false }]],
    hideSkippedTests: true,
    config: false,
    fileParallelism: false,
    sequence: {
      sequencer: class StableTestFileOrderSorter {
        sort(files: TestSpecification[]) {
          return files.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
        }

        shard(files: TestSpecification[]) {
          return files
        }
      },
    },
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "✓ fixtures/verbose/example-1.test.ts > test pass in root [...]ms
     ✓ fixtures/verbose/example-1.test.ts > suite in root > test pass in 1. suite #1 [...]ms
     ✓ fixtures/verbose/example-1.test.ts > suite in root > test pass in 1. suite #2 [...]ms
     ✓ fixtures/verbose/example-1.test.ts > suite in root > suite in suite > test pass in nested suite #1 [...]ms
     ✓ fixtures/verbose/example-1.test.ts > suite in root > suite in suite > test pass in nested suite #2 [...]ms
     × fixtures/verbose/example-1.test.ts > suite in root > suite in suite > suite in nested suite > test failure in 2x nested suite [...]ms
       → expected 'should fail' to be 'as expected' // Object.is equality
     ✓ fixtures/verbose/example-2.test.ts > test 0.1 [...]ms
     ✓ fixtures/verbose/example-2.test.ts > suite 1.1 > test 1.1 [...]ms"
  `)
})

function trimReporterOutput(report: string) {
  const rows = report.replace(/\d+ms/g, '[...]ms').split('\n')

  // Trim start and end, capture just rendered tree
  rows.splice(0, 1 + rows.findIndex(row => row.includes('RUN  v')))
  rows.splice(rows.findIndex(row => row.includes('Test Files')))

  return rows.join('\n').trim()
}
