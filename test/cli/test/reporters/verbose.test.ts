import type { TestSpecification } from 'vitest/node'
import { runVitest } from '#test-utils'
import { expect, test } from 'vitest'

test('duration', async () => {
  const { stdout } = await runVitest({
    root: 'fixtures/reporters/duration',
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
    root: 'fixtures/reporters/error-props',
    reporters: 'verbose',
    env: { CI: '1' },
  })

  expect(result.stderr).toContain(`Serialized Error: { code: 404, status: 'not found' }`)
})

test('prints skipped tests by default', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/reporters/pass-and-skip-test-suites.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    config: false,
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "✓ fixtures/reporters/pass-and-skip-test-suites.test.ts > passing test #1 [...]ms
     ✓ fixtures/reporters/pass-and-skip-test-suites.test.ts > passing suite > passing test #2 [...]ms
     ↓ fixtures/reporters/pass-and-skip-test-suites.test.ts > skipped test #1
     ↓ fixtures/reporters/pass-and-skip-test-suites.test.ts > skipped suite > skipped test #2"
  `)
})

test('hides skipped tests when --hideSkippedTests', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/reporters/pass-and-skip-test-suites.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    hideSkippedTests: true,
    config: false,
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
    "✓ fixtures/reporters/pass-and-skip-test-suites.test.ts > passing test #1 [...]ms
     ✓ fixtures/reporters/pass-and-skip-test-suites.test.ts > passing suite > passing test #2 [...]ms"
  `)
})

test('prints retry count', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/reporters/retry.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    retry: 3,
    config: false,
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`"✓ fixtures/reporters/retry.test.ts > pass after retries [...]ms (retry x3)"`)
})

test('prints repeat count', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/reporters/repeats.test.ts'],
    reporters: [['verbose', { isTTY: true, summary: false }]],
    config: false,
  })

  expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`"✓ fixtures/reporters/repeats.test.ts > repeat couple of times [...]ms (repeat x3)"`)
})

test('renders tests in a list', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/reporters/verbose/*.test.ts'],
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
    "✓ fixtures/reporters/verbose/example-1.test.ts > test pass in root [...]ms
     ↓ fixtures/reporters/verbose/example-1.test.ts > test skip in root
     ✓ fixtures/reporters/verbose/example-1.test.ts > suite in root > test pass in 1. suite #1 [...]ms
     ✓ fixtures/reporters/verbose/example-1.test.ts > suite in root > test pass in 1. suite #2 [...]ms
     ✓ fixtures/reporters/verbose/example-1.test.ts > suite in root > suite in suite > test pass in nested suite #1 [...]ms
     ✓ fixtures/reporters/verbose/example-1.test.ts > suite in root > suite in suite > test pass in nested suite #2 [...]ms
     × fixtures/reporters/verbose/example-1.test.ts > suite in root > suite in suite > suite in nested suite > test failure in 2x nested suite [...]ms
       → expected 'should fail' to be 'as expected' // Object.is equality
     ↓ fixtures/reporters/verbose/example-1.test.ts > suite skip in root > test 1.3
     ↓ fixtures/reporters/verbose/example-1.test.ts > suite skip in root > suite in suite > test in nested suite
     ↓ fixtures/reporters/verbose/example-1.test.ts > suite skip in root > suite in suite > test failure in nested suite of skipped suite
     ✓ fixtures/reporters/verbose/example-2.test.ts > test 0.1 [...]ms
     ↓ fixtures/reporters/verbose/example-2.test.ts > test 0.2
     ✓ fixtures/reporters/verbose/example-2.test.ts > suite 1.1 > test 1.1 [...]ms"
  `)
})

test('renders locations if enabled', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/reporters/verbose/*.test.ts'],
    reporters: [['verbose', { isTTY: false, summary: false }]],
    config: false,
    includeTaskLocation: true,
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
    "✓ fixtures/reporters/verbose/example-1.test.ts:3:1 > test pass in root [...]ms
     ↓ fixtures/reporters/verbose/example-1.test.ts:5:6 > test skip in root
     ✓ fixtures/reporters/verbose/example-1.test.ts:8:3 > suite in root > test pass in 1. suite #1 [...]ms
     ✓ fixtures/reporters/verbose/example-1.test.ts:10:3 > suite in root > test pass in 1. suite #2 [...]ms
     ✓ fixtures/reporters/verbose/example-1.test.ts:13:5 > suite in root > suite in suite > test pass in nested suite #1 [...]ms
     ✓ fixtures/reporters/verbose/example-1.test.ts:15:5 > suite in root > suite in suite > test pass in nested suite #2 [...]ms
     × fixtures/reporters/verbose/example-1.test.ts:18:7 > suite in root > suite in suite > suite in nested suite > test failure in 2x nested suite [...]ms
       → expected 'should fail' to be 'as expected' // Object.is equality
     ↓ fixtures/reporters/verbose/example-1.test.ts:26:3 > suite skip in root > test 1.3
     ↓ fixtures/reporters/verbose/example-1.test.ts:29:5 > suite skip in root > suite in suite > test in nested suite
     ↓ fixtures/reporters/verbose/example-1.test.ts:31:5 > suite skip in root > suite in suite > test failure in nested suite of skipped suite
     ✓ fixtures/reporters/verbose/example-2.test.ts:3:1 > test 0.1 [...]ms
     ↓ fixtures/reporters/verbose/example-2.test.ts:5:6 > test 0.2
     ✓ fixtures/reporters/verbose/example-2.test.ts:8:3 > suite 1.1 > test 1.1 [...]ms"
  `)
})

test('hides skipped tests when --hideSkippedTests and in non-TTY', async () => {
  const { stdout } = await runVitest({
    include: ['fixtures/reporters/verbose/*.test.ts'],
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
    "✓ fixtures/reporters/verbose/example-1.test.ts > test pass in root [...]ms
     ✓ fixtures/reporters/verbose/example-1.test.ts > suite in root > test pass in 1. suite #1 [...]ms
     ✓ fixtures/reporters/verbose/example-1.test.ts > suite in root > test pass in 1. suite #2 [...]ms
     ✓ fixtures/reporters/verbose/example-1.test.ts > suite in root > suite in suite > test pass in nested suite #1 [...]ms
     ✓ fixtures/reporters/verbose/example-1.test.ts > suite in root > suite in suite > test pass in nested suite #2 [...]ms
     × fixtures/reporters/verbose/example-1.test.ts > suite in root > suite in suite > suite in nested suite > test failure in 2x nested suite [...]ms
       → expected 'should fail' to be 'as expected' // Object.is equality
     ✓ fixtures/reporters/verbose/example-2.test.ts > test 0.1 [...]ms
     ✓ fixtures/reporters/verbose/example-2.test.ts > suite 1.1 > test 1.1 [...]ms"
  `)
})

function trimReporterOutput(report: string) {
  const rows = report.replace(/\d+ms/g, '[...]ms').split('\n')

  // Trim start and end, capture just rendered tree
  rows.splice(0, 1 + rows.findIndex(row => row.includes('RUN  v')))
  rows.splice(rows.findIndex(row => row.includes('Test Files')))

  return rows.join('\n').trim()
}
