import type { RunnerTask } from 'vitest/node'
import { runVitest, runVitestCli, StableTestFileOrderSorter } from '#test-utils'
import { describe, expect, test } from 'vitest'
import { DefaultReporter } from 'vitest/node'
import { trimReporterOutput } from './utils'

describe('default reporter', async () => {
  test('normal', async () => {
    const { stdout } = await runVitest({
      include: ['b1.test.ts', 'b2.test.ts'],
      root: 'fixtures/reporters/default',
      reporters: ['default'],
      fileParallelism: false,
      sequence: {
        sequencer: StableTestFileOrderSorter,
      },
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "❯ b1.test.ts (13 tests | 1 failed) [...]ms
           ✓ b1 test [...]ms
           ✓ b2 test [...]ms
           ✓ b3 test [...]ms
             ✓ nested b1 test [...]ms
             ✓ nested b2 test [...]ms
             ✓ nested b3 test [...]ms
           ✓ b1 test [...]ms
           ✓ b2 test [...]ms
           ✓ b3 test [...]ms
           × b failed test [...]ms
             ✓ nested b1 test [...]ms
             ✓ nested b2 test [...]ms
             ✓ nested b3 test [...]ms
       ❯ b2.test.ts (13 tests | 1 failed) [...]ms
           ✓ b1 test [...]ms
           ✓ b2 test [...]ms
           ✓ b3 test [...]ms
             ✓ nested b1 test [...]ms
             ✓ nested b2 test [...]ms
             ✓ nested b3 test [...]ms
           ✓ b1 test [...]ms
           ✓ b2 test [...]ms
           ✓ b3 test [...]ms
           × b failed test [...]ms
             ✓ nested b1 test [...]ms
             ✓ nested b2 test [...]ms
             ✓ nested b3 test [...]ms"
    `)
  })

  test('normal without fails', async () => {
    const { stdout } = await runVitest({
      include: ['b1.test.ts', 'b2.test.ts'],
      root: 'fixtures/reporters/default',
      reporters: ['default'],
      fileParallelism: false,
      testNamePattern: 'passed',
      sequence: {
        sequencer: StableTestFileOrderSorter,
      },
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "✓ b1.test.ts (13 tests | 7 skipped) [...]ms
       ✓ b2.test.ts (13 tests | 7 skipped) [...]ms"
    `)
  })

  test('show full test suite when only one file', async () => {
    const { stdout } = await runVitest({
      include: ['a.test.ts'],
      root: 'fixtures/reporters/default',
      reporters: 'none',
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "❯ a.test.ts (16 tests | 1 failed | 3 skipped) [...]ms
         ✓ a passed (6)
           ✓ a1 test [...]ms
           ✓ a2 test [...]ms
           ✓ a3 test [...]ms
           ✓ nested a (3)
             ✓ nested a1 test [...]ms
             ✓ nested a2 test [...]ms
             ✓ nested a3 test [...]ms
         ❯ a failed (7)
           ✓ a failed 1 test [...]ms
           ✓ a failed 2 test [...]ms
           ✓ a failed 3 test [...]ms
           × a failed test [...]ms
           ✓ nested a failed (3)
             ✓ nested a failed 1 test [...]ms
             ✓ nested a failed 2 test [...]ms
             ✓ nested a failed 3 test [...]ms
         ✓ a skipped (3)
           ↓ skipped with note [...]ms [reason]
           ↓ condition [...]ms
           ↓ condition with note [...]ms [note]"
    `)
  })

  test('rerun should undo', async () => {
    const { vitest } = await runVitest({
      root: 'fixtures/reporters/default',
      watch: true,
      testNamePattern: 'passed',
      reporters: 'none',
    })

    // one file
    vitest.write('p')
    await vitest.waitForStdout('Input filename pattern')
    vitest.write('a')
    await vitest.waitForStdout('a.test.ts')
    vitest.write('\n')
    await vitest.waitForStdout('Filename pattern: a')
    await vitest.waitForStdout('Waiting for file changes...')

    expect(vitest.stdout).toContain('✓ a passed')
    expect(vitest.stdout).toContain('✓ a1 test')
    expect(vitest.stdout).toContain('✓ nested a')
    expect(vitest.stdout).toContain('✓ nested a3 test')

    // rerun and two files
    vitest.write('p')
    await vitest.waitForStdout('Input filename pattern')
    vitest.write('b\n')
    await vitest.waitForStdout('Waiting for file changes...')
    expect(vitest.stdout).toContain('✓ b1.test.ts')
    expect(vitest.stdout).toContain('✓ b2.test.ts')
    expect(vitest.stdout).not.toContain('✓ b2 failed')
  })

  test('doesn\'t print error properties', async () => {
    const result = await runVitest({
      root: 'fixtures/reporters/error-props',
      reporters: 'default',
      env: { CI: '1' },
    })

    expect(result.stderr).not.toContain(`Serialized Error`)
    expect(result.stderr).not.toContain(`status: 'not found'`)
  })

  test('prints queued tests as soon as they are added', async () => {
    const { stdout, vitest } = await runVitest({
      include: ['fixtures/reporters/long-loading-task.test.ts'],
      reporters: [['default', { isTTY: true, summary: true }]],
      config: 'fixtures/reporters/vitest.config.ts',
      watch: true,
    })

    await vitest.waitForStdout('❯ fixtures/reporters/long-loading-task.test.ts [queued]')
    await vitest.waitForStdout('Waiting for file changes...')

    expect(stdout).toContain('✓ fixtures/reporters/long-loading-task.test.ts (1 test)')
  })

  test('prints skipped tests by default when a single file is run', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/reporters/pass-and-skip-test-suites.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      config: 'fixtures/reporters/vitest.config.ts',
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "✓ fixtures/reporters/pass-and-skip-test-suites.test.ts (4 tests | 2 skipped) [...]ms
         ✓ passing test #1 [...]ms
         ✓ passing suite (1)
           ✓ passing test #2 [...]ms
         ↓ skipped test #1
         ↓ skipped suite (1)
           ↓ skipped test #2"
    `)
  })

  test('hides skipped tests when --hideSkippedTests and a single file is run', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/reporters/pass-and-skip-test-suites.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      hideSkippedTests: true,
      config: false,
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "✓ fixtures/reporters/pass-and-skip-test-suites.test.ts (4 tests | 2 skipped) [...]ms
         ✓ passing test #1 [...]ms
         ✓ passing suite (1)
           ✓ passing test #2 [...]ms"
    `)
  })

  test('prints retry count', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/reporters/retry.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      retry: 3,
      config: false,
    })

    expect(stdout).toContain('1 passed')
    expect(trimReporterOutput(stdout)).toContain('✓ pass after retries [...]ms (retry x3)')
  })

  test('prints repeat count', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/reporters/repeats.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      config: false,
    })

    expect(stdout).toContain('1 passed')
    expect(trimReporterOutput(stdout)).toContain('✓ repeat couple of times [...]ms (repeat x3)')
  })

  test('prints 0-based index and 1-based index of the test case', async () => {
    const { stdout } = await runVitest({
      include: ['print-index.test.ts'],
      root: 'fixtures/reporters/default',
      reporters: 'none',
    })

    expect(stdout).toContain('✓ 0-based index of the test case is 0')
    expect(stdout).toContain('✓ 0-based index of the test case is 1')
    expect(stdout).toContain('✓ 0-based index of the test case is 2')

    expect(stdout).toContain('✓ 1-based index of the test case is 1')
    expect(stdout).toContain('✓ 1-based index of the test case is 2')
    expect(stdout).toContain('✓ 1-based index of the test case is 3')
  })

  test('test.each/for title format', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/reporters/test-for-title.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      config: false,
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "✓ fixtures/reporters/test-for-title.test.ts (24 tests) [...]ms
         ✓ test.for object : 0 = 'a', 2 = { te: 'st' } [...]ms
         ✓ test.for object : 0 = 'b', 2 = [ 'test' ] [...]ms
         ✓ test.each object : 0 = 'a', 2 = { te: 'st' }  [...]ms
         ✓ test.each object : 0 = 'b', 2 = [ 'test' ]  [...]ms
         ✓ test.for array : 0 = 'a', 2 = { te: 'st' } [...]ms
         ✓ test.for array : 0 = 'b', 2 = [ 'test' ] [...]ms
         ✓ test.each array : 0 = 'a', 2 = { te: 'st' } [...]ms
         ✓ test.each array : 0 = 'b', 2 = [ 'test' ] [...]ms
         ✓ object : add(1, 1) -> 2 [...]ms
         ✓ object : add(1, 2) -> 3 [...]ms
         ✓ object : add(2, 1) -> 3 [...]ms
         ✓ array : add(1, 1) -> 2 [...]ms
         ✓ array : add(1, 2) -> 3 [...]ms
         ✓ array : add(2, 1) -> 3 [...]ms
         ✓ first array element is object: 0 = { k1: 'v1' }, 1 = { k2: 'v2' }, k1 = 'v1', k2 = undefined [...]ms
         ✓ first array element is not object: 0 = 'foo', 1 = 'bar', k = $k [...]ms
         ✓ not array: 0 = { k: 'v1' }, 1 = undefined, k = 'v1' [...]ms
         ✓ not array: 0 = { k: 'v2' }, 1 = undefined, k = 'v2' [...]ms
         ✓ handles whole numbers: 343434 as $343,434.00 [...]ms
         ✓ { a: '$b', b: 'yay' } [...]ms
         ✓ '%o' [...]ms
         ✓ { a: '%o' } [...]ms
         ✓ '%o' { a: '%o' } [...]ms
         ✓ { a: '%o' } '%o' [...]ms"
    `)
  })

  test('project name color', async () => {
    const { stdout } = await runVitestCli(
      { preserveAnsi: true },
      '--root',
      'fixtures/reporters/project-name',
    )

    expect(stdout).toContain('Example project')
    expect(stdout).toContain('\x1B[30m\x1B[45m Example project \x1B[49m\x1B[39m')
  })

  test('extended reporter can override getFullName', async () => {
    class Custom extends DefaultReporter {
      getFullName(test: RunnerTask, separator?: string): string {
        return `${separator}{ name: ${test.name}, meta: ${test.meta.custom} } (Custom getFullName here)`
      }
    }

    const { stderr } = await runVitest({
      root: 'fixtures/reporters/metadata',
      reporters: new Custom(),
    })

    expect(stderr).toMatch('FAIL   > { name: fails, meta: Failing test added this } (Custom getFullName here')
  })

  test('merge identical errors', async () => {
    const { stderr } = await runVitest({
      root: 'fixtures/reporters/merge-errors',
      reporters: [['default', { isTTY: true, summary: false }]],
      config: false,
    })
    expect(stderr).toMatchSnapshot()
  })
}, 120000)
