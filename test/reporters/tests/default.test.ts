import type { RunnerTask, TestSpecification } from 'vitest/node'
import { describe, expect, test } from 'vitest'
import { DefaultReporter } from 'vitest/reporters'
import { runVitest, runVitestCli } from '../../test-utils'

describe('default reporter', async () => {
  test('normal', async () => {
    const { stdout } = await runVitest({
      include: ['b1.test.ts', 'b2.test.ts'],
      root: 'fixtures/default',
      reporters: 'none',
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
      "❯ b1.test.ts (13 tests | 1 failed) [...]ms
         ✓ b1 passed > b1 test [...]ms
         ✓ b1 passed > b2 test [...]ms
         ✓ b1 passed > b3 test [...]ms
         ✓ b1 passed > nested b > nested b1 test [...]ms
         ✓ b1 passed > nested b > nested b2 test [...]ms
         ✓ b1 passed > nested b > nested b3 test [...]ms
         ✓ b1 failed > b1 test [...]ms
         ✓ b1 failed > b2 test [...]ms
         ✓ b1 failed > b3 test [...]ms
         × b1 failed > b failed test [...]ms
           → expected 1 to be 2 // Object.is equality
         ✓ b1 failed > nested b > nested b1 test [...]ms
         ✓ b1 failed > nested b > nested b2 test [...]ms
         ✓ b1 failed > nested b > nested b3 test [...]ms
       ❯ b2.test.ts (13 tests | 1 failed) [...]ms
         ✓ b2 passed > b1 test [...]ms
         ✓ b2 passed > b2 test [...]ms
         ✓ b2 passed > b3 test [...]ms
         ✓ b2 passed > nested b > nested b1 test [...]ms
         ✓ b2 passed > nested b > nested b2 test [...]ms
         ✓ b2 passed > nested b > nested b3 test [...]ms
         ✓ b2 failed > b1 test [...]ms
         ✓ b2 failed > b2 test [...]ms
         ✓ b2 failed > b3 test [...]ms
         × b2 failed > b failed test [...]ms
           → expected 1 to be 2 // Object.is equality
         ✓ b2 failed > nested b > nested b1 test [...]ms
         ✓ b2 failed > nested b > nested b2 test [...]ms
         ✓ b2 failed > nested b > nested b3 test [...]ms"
    `)
  })

  test('show full test suite when only one file', async () => {
    const { stdout } = await runVitest({
      include: ['a.test.ts'],
      root: 'fixtures/default',
      reporters: 'none',
    })

    expect(stdout).toContain('✓ a passed > a1 test')
    expect(stdout).toContain('✓ a passed > nested a > nested a3 test')
    expect(stdout).toContain('× a failed > a failed test')
    expect(stdout).toContain('nested a failed 1 test')
    expect(stdout).toContain('[note]')
    expect(stdout).toContain('[reason]')
  })

  test('rerun should undo', async () => {
    const { vitest } = await runVitest({
      root: 'fixtures/default',
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

    expect(vitest.stdout).contain('✓ a passed > a1 test')
    expect(vitest.stdout).contain('✓ a passed > nested a > nested a3 test')

    // rerun and two files
    vitest.write('p')
    await vitest.waitForStdout('Input filename pattern')
    vitest.write('b\n')
    await vitest.waitForStdout('Waiting for file changes...')
    expect(vitest.stdout).toContain('✓ b1.test.ts')
    expect(vitest.stdout).toContain('✓ b2.test.ts')
    expect(vitest.stdout).not.toContain('✓ nested b1 test')
    expect(vitest.stdout).not.toContain('✓ b1 test')
    expect(vitest.stdout).not.toContain('✓ b2 test')
  })

  test('doesn\'t print error properties', async () => {
    const result = await runVitest({
      root: 'fixtures/error-props',
      reporters: 'default',
      env: { CI: '1' },
    })

    expect(result.stderr).not.toContain(`Serialized Error`)
    expect(result.stderr).not.toContain(`status: 'not found'`)
  })

  test('prints queued tests as soon as they are added', async () => {
    const { stdout, vitest } = await runVitest({
      include: ['fixtures/long-loading-task.test.ts'],
      reporters: [['default', { isTTY: true, summary: true }]],
      config: 'fixtures/vitest.config.ts',
      watch: true,
    })

    await vitest.waitForStdout('❯ fixtures/long-loading-task.test.ts [queued]')
    await vitest.waitForStdout('Waiting for file changes...')

    expect(stdout).toContain('✓ fixtures/long-loading-task.test.ts (1 test)')
  })

  test('prints skipped tests by default when a single file is run', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/pass-and-skip-test-suites.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      config: 'fixtures/vitest.config.ts',
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "✓ fixtures/pass-and-skip-test-suites.test.ts (4 tests | 2 skipped) [...]ms
         ✓ passing test #1 [...]ms
         ✓ passing suite > passing test #2 [...]ms
         ↓ skipped test #1
         ↓ skipped suite > skipped test #2"
    `)
  })

  test('hides skipped tests when --hideSkippedTests and a single file is run', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/pass-and-skip-test-suites.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      hideSkippedTests: true,
      config: false,
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "✓ fixtures/pass-and-skip-test-suites.test.ts (4 tests | 2 skipped) [...]ms
         ✓ passing test #1 [...]ms
         ✓ passing suite > passing test #2 [...]ms"
    `)
  })

  test('prints retry count', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/retry.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      retry: 3,
      config: false,
    })

    expect(stdout).toContain('1 passed')
    expect(trimReporterOutput(stdout)).toContain('✓ pass after retries [...]ms (retry x3)')
  })

  test('prints repeat count', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/repeats.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      config: false,
    })

    expect(stdout).toContain('1 passed')
    expect(trimReporterOutput(stdout)).toContain('✓ repeat couple of times [...]ms (repeat x3)')
  })

  test('prints 0-based index and 1-based index of the test case', async () => {
    const { stdout } = await runVitest({
      include: ['print-index.test.ts'],
      root: 'fixtures/default',
      reporters: 'none',
    })

    expect(stdout).toContain('✓ passed > 0-based index of the test case is 0')
    expect(stdout).toContain('✓ passed > 0-based index of the test case is 1')
    expect(stdout).toContain('✓ passed > 0-based index of the test case is 2')

    expect(stdout).toContain('✓ passed > 1-based index of the test case is 1')
    expect(stdout).toContain('✓ passed > 1-based index of the test case is 2')
    expect(stdout).toContain('✓ passed > 1-based index of the test case is 3')
  })

  test('test.each/for title format', async () => {
    const { stdout } = await runVitest({
      include: ['fixtures/test-for-title.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      config: false,
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "✓ fixtures/test-for-title.test.ts (18 tests) [...]ms
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
         ✓ not array: 0 = { k: 'v2' }, 1 = undefined, k = 'v2' [...]ms"
    `)
  })

  test('reporter handles for each.test core', async () => {
    const { stdout } = await runVitest({
      include: ['../core/test/each.test.ts'],
      reporters: [['default', { isTTY: true, summary: false }]],
      config: false,
    })

    expect(trimReporterOutput(stdout)).toMatchInlineSnapshot(`
      "✓ ../core/test/each.test.ts (70 tests | 3 skipped) [...]ms
         ✓ add(1, 1) -> 2 [...]ms
         ✓ add(1, 2) -> 3 [...]ms
         ✓ add(2, 1) -> 3 [...]ms
         ✓ can be parsed [...]ms
         ✓ can be parsed [...]ms
         ✓ describe add(1, 1) > returns 2 [...]ms
         ✓ describe add(1, 1) > returned value not be greater than 2 [...]ms
         ✓ describe add(1, 1) > returned value not be less than 2 [...]ms
         ✓ describe add(1, 2) > returns 3 [...]ms
         ✓ describe add(1, 2) > returned value not be greater than 3 [...]ms
         ✓ describe add(1, 2) > returned value not be less than 3 [...]ms
         ✓ describe add(2, 1) > returns 3 [...]ms
         ✓ describe add(2, 1) > returned value not be greater than 3 [...]ms
         ✓ describe add(2, 1) > returned value not be less than 3 [...]ms
         ✓ describe concatenate(1, a) > returns 1a [...]ms
         ✓ describe concatenate(1, b) > returns 1b [...]ms
         ✓ describe concatenate(2, c) > returns 2c [...]ms
         ✓ describe object add(1, 1) > returns 2 [...]ms
         ✓ describe object add(1, 1) > returned value not be greater than 2 [...]ms
         ✓ describe object add(1, 1) > returned value not be less than 2 [...]ms
         ✓ describe object add(1, 2) > returns 3 [...]ms
         ✓ describe object add(1, 2) > returned value not be greater than 3 [...]ms
         ✓ describe object add(1, 2) > returned value not be less than 3 [...]ms
         ✓ describe object add(2, 1) > returns 3 [...]ms
         ✓ describe object add(2, 1) > returned value not be greater than 3 [...]ms
         ✓ describe object add(2, 1) > returned value not be less than 3 [...]ms
         ✓ 1 (describe.each 1d) > 1 is a number (describe.each 1d) [...]ms
         ✓ 2 (describe.each 1d) > 2 is a number (describe.each 1d) [...]ms
         ✓ 0 (describe.each 1d) > 0 is a number (describe.each 1d) [...]ms
         ✓ the index of the test case is 0 [...]ms
         ✓ the index of the test case is 1 [...]ms
         ✓ the index of the test case is 2 [...]ms
         ✓ return a promise like result 0 [...]ms
         ✓ return a promise like result 1 [...]ms
         ✓ the number of the test case is 1 [...]ms
         ✓ the number of the test case is 2 [...]ms
         ✓ the number of the test case is 3 [...]ms
         ✓ return a promise like result 1 [...]ms
         ✓ return a promise like result 2 [...]ms
         ↓ context on test and describe - todo/skip > todo describe > this is todo test
         ↓ context on test and describe - todo/skip > todo describe > this is todo test
         ↓ context on test and describe - todo/skip > todo test
         ✓ context with each - concurrent > block > numbered test [...]ms
         ✓ context with each - concurrent > block > numbered test [...]ms
         ✓ context with each - concurrent > block > numbered test [...]ms
         ✓ not all arguments are array describe.each > null is null > null is null [...]ms
         ✓ not all arguments are array describe.each > null is null > null is null [...]ms
         ✓ not all arguments are array test.each > matches results [...]ms
         ✓ not all arguments are array test.each > matches results [...]ms
         ✓ value is null [...]ms
         ✓ if all cases are arrays of equal length, treats array elements as arguments [...]ms
         ✓ if all cases are arrays of equal length, treats array elements as arguments [...]ms
         ✓ describe template string add(1, 1) > returns 2 [...]ms
         ✓ describe template string add('a', 'b') > returns ab [...]ms
         ✓ describe template string add([], 'b') > returns b [...]ms
         ✓ describe template string add({}, 'b') > returns [object Object]b [...]ms
         ✓ describe template string add({ asd: 1 }, 'b') > returns [object Object]b [...]ms
         ✓ returns 2 when 1 is added 1 [...]ms
         ✓ returns 'ab' when 'a' is added 'b' [...]ms
         ✓ returns 'b' when [] is added 'b' [...]ms
         ✓ returns '[object Object]b' when {} is added 'b' [...]ms
         ✓ returns '[object Object]b' when { asd: 1 } is added 'b' [...]ms
         ✓ returns '1b' when 1 is added 'b' [...]ms
         ✓ returns '2b' when 2 is added 'b' [...]ms
         ✓ returns '3b' when 3 is added 'b' [...]ms
         ✓ (true && true) -> true [...]ms
         ✓ ({ val: 1 } && { val: 2 }) -> 3 [...]ms
         ✓ handles whole numbers: 343434 as $343,434.00 [...]ms
         ✓ { a: '$b', b: 'yay' } [...]ms
         ✓ '%o' [...]ms"
    `)
  })

  test('project name color', async () => {
    const { stdout } = await runVitestCli(
      { preserveAnsi: true },
      '--root',
      'fixtures/project-name',
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
      root: 'fixtures/metadata',
      reporters: new Custom(),
    })

    expect(stderr).toMatch('FAIL   > { name: fails, meta: Failing test added this } (Custom getFullName here')
  })
}, 120000)

function trimReporterOutput(report: string) {
  const rows = report.replace(/\d+ms/g, '[...]ms').split('\n')

  // Trim start and end, capture just rendered tree
  rows.splice(0, 1 + rows.findIndex(row => row.includes('RUN  v')))
  rows.splice(rows.findIndex(row => row.includes('Test Files')))

  return rows.join('\n').trim()
}
