import { expect, onTestFailed, onTestFinished, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'
import { instances } from '../settings'
import { runInlineBrowserTests } from './utils'

// TODO: investigate `isolate: false` tests.
// Doesn't seem like we can run things in parallel if there are mocks
test.each([true /* , false */])('mocking works correctly - isolated %s', async (isolate) => {
  const result = await runVitest({
    root: 'fixtures/mocking',
    isolate,
  })

  onTestFailed(() => {
    console.error(result.stdout)
    console.error(result.stderr)
  })

  expect(result.stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(result.stdout).toReportPassedTest('automocked.test.ts', browser)
    expect(result.stdout).toReportPassedTest('automocked-default-return.test.ts', browser)
    expect(result.stdout).toReportPassedTest('mocked-__mocks__.test.ts', browser)
    expect(result.stdout).toReportPassedTest('mocked-factory.test.ts', browser)
    expect(result.stdout).toReportPassedTest('mocked-factory-hoisted.test.ts', browser)
    expect(result.stdout).toReportPassedTest('not-mocked.test.ts', browser)
    expect(result.stdout).toReportPassedTest('mocked-nested.test.ts', browser)
    expect(result.stdout).toReportPassedTest('not-mocked-nested.test.ts', browser)
    expect(result.stdout).toReportPassedTest('import-actual-in-mock.test.ts', browser)
    expect(result.stdout).toReportPassedTest('import-actual-query.test.ts', browser)
    expect(result.stdout).toReportPassedTest('import-mock.test.ts', browser)
    expect(result.stdout).toReportPassedTest('src/aaa-dual-id-probe.test.ts', browser)
    expect(result.stdout).toReportPassedTest('src/zzz-dual-id-target.test.ts', browser)
    expect(result.stdout).toReportPassedTest('mocked-do-mock-factory.test.ts', browser)
    expect(result.stdout).toReportPassedTest('import-actual-dep.test.ts', browser)
  })

  expect(result.exitCode).toBe(0)
})

test('manual mocks do not leak across browser files when alias and relative ids resolve to the same module', async () => {
  const result = await runVitest(
    {
      root: 'fixtures/mocking',
    },
    ['src/aaa-dual-id-probe.test.ts', 'src/zzz-dual-id-target.test.ts'],
  )

  onTestFailed(() => {
    console.error(result.stdout)
    console.error(result.stderr)
  })

  expect(result.stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(result.stdout).toReportPassedTest('src/aaa-dual-id-probe.test.ts', browser)
    expect(result.stdout).toReportPassedTest('src/zzz-dual-id-target.test.ts', browser)
  })

  expect(result.exitCode).toBe(0)
}, 60_000)

test('mocking dependency correctly invalidates it on rerun', async () => {
  const { vitest, ctx } = await runVitest({
    root: 'fixtures/mocking-watch',
    watch: true,
  })
  onTestFinished(async () => {
    await ctx.close()
  })

  await vitest.waitForStdout('Waiting for file changes...')

  expect(vitest.stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(vitest.stdout).toReportPassedTest('1_mocked-on-watch-change.test.ts', browser)
    expect(vitest.stdout).toReportPassedTest('2_not-mocked-import.test.ts', browser)
  })

  vitest.resetOutput()
  editFile('./fixtures/mocking-watch/1_mocked-on-watch-change.test.ts', (content) => `${content}\n`)

  await vitest.waitForStdout('Waiting for file changes...')

  expect(vitest.stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(vitest.stdout).toReportPassedTest('1_mocked-on-watch-change.test.ts', browser)
    expect(vitest.stdout).not.toReportPassedTest('2_not-mocked-import.test.ts', browser)
  })
})

test('mocking out of root', async () => {
  const { vitest, ctx } = await runVitest({
    root: 'fixtures/mocking-out-of-root/project1',
  })
  onTestFinished(async () => {
    await ctx.close()
  })
  expect(vitest.stderr).toReportNoErrors()
  instances.forEach(({ browser }) => {
    expect(vitest.stdout).toReportPassedTest('basic.test.js', browser)
  })
})

// fix https://github.com/vitest-dev/vitest/issues/11519
test('mocks from a setup file apply to static imports of a test file', async () => {
  const result = await runVitest({
    root: 'fixtures/mocking-setup-file',
  })

  onTestFailed(() => {
    console.error(result.stdout)
    console.error(result.stderr)
  })

  expect(result.stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(result.stdout).toReportPassedTest('static-import.test.ts', browser)
    expect(result.stdout).toReportPassedTest('dynamic-import.test.ts', browser)
  })

  expect(result.exitCode).toBe(0)
})

// fix https://github.com/vitest-dev/vitest/issues/7788
test('mocks modules next to a test file in a directory with spaces', async () => {
  const { errorTree } = await runInlineBrowserTests({
    'space dir/source.ts': `export function answer() { return 42 }`,
    'space dir/redirect.ts': `export function value() { return 'original' }`,
    'space dir/__mocks__/redirect.ts': `export function value() { return 'mocked' }`,
    'space dir/factory.ts': `export const name = 'original'`,
    'space dir/basic.test.ts': `
import { expect, test, vi } from 'vitest'
import { name } from './factory'
import { value } from './redirect'
import { answer } from './source'

vi.mock('./source', { spy: true })
vi.mock('./redirect')
vi.mock('./factory', () => ({ name: 'factory' }))

test('spy', () => {
  expect(vi.isMockFunction(answer)).toBe(true)
})

test('redirect', () => {
  expect(value()).toBe('mocked')
})

test('factory', () => {
  expect(name).toBe('factory')
})

test('error location', () => {
  expect(answer()).toBe(0)
})
`,
  })

  const trees = errorTree({ project: true, stackTrace: true })
  expect(Object.keys(trees).sort()).toEqual(instances.map(({ browser }) => browser).sort())
  for (const tree of Object.values(trees)) {
    expect(tree).toMatchInlineSnapshot(`
      {
        "space dir/basic.test.ts": {
          "error location": [
            "expected 42 to be +0 // Object.is equality
          at space dir/basic.test.ts:24:20",
          ],
          "factory": "passed",
          "redirect": "passed",
          "spy": "passed",
        },
      }
    `)
  }
})
