import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'pathe'
import { expect, onTestFailed, onTestFinished, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'
import { instances, provider } from '../settings'

// TODO: investigate `isolate: false` tests.
// Doesn't seem like we can run things in parallel if there are mocks
test.each([
  { isolate: true, importMapMocks: false },
  { isolate: true, importMapMocks: true },
])(
  'mocking works correctly - isolated $isolate, importMapMocks $importMapMocks',
  async ({ isolate, importMapMocks }) => {
    const result = await runVitest({
      root: 'fixtures/mocking',
      isolate,
      browser: { importMapMocks },
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
      expect(result.stdout).toReportPassedTest('mocked-factory-star.test.ts', browser)
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
  },
)

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
test.each([false, true])(
  'mocks from a setup file apply to static imports of a test file - importMapMocks %s',
  async (importMapMocks) => {
    const result = await runVitest({
      root: 'fixtures/mocking-setup-file',
      browser: { importMapMocks },
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
  },
)

test('import map mocks report a module that was imported before it was mocked', async () => {
  const result = await runVitest({
    root: 'fixtures/mocking-import-map-conflict',
    browser: { importMapMocks: true },
  })

  instances.forEach(({ browser }) => {
    expect(result.stdout).not.toReportPassedTest('already-imported.test.ts', browser)
  })

  expect(result.stderr).toContain(
    'Cannot mock "/source.ts" with an import map because the browser kept its original URL.',
  )
  expect(result.exitCode).toBe(1)
})

test.runIf(provider.name === 'playwright')(
  'mocks fall back to request interception when the browser rejects a late import map',
  async () => {
    const result = await runVitest({
      root: 'fixtures/mocking-import-map-fallback',
    })

    onTestFailed(() => {
      console.error(result.stdout)
      console.error(result.stderr)
    })

    expect(result.stderr).toReportNoErrors()
    expect(result.stdout).toReportPassedTest('automocked.test.ts', 'firefox')
    expect(result.stdout).toReportPassedTest('factory.test.ts', 'firefox')
    expect(result.exitCode).toBe(0)
  },
)

test.each([false, undefined])(
  'a factory mock that no test imports does not transform the original - importMapMocks %s',
  async (importMapMocks) => {
    const transformed = resolve(
      import.meta.dirname,
      '../fixtures/mocking-unused-factory/node_modules/.vite/transformed.log',
    )
    rmSync(transformed, { force: true })

    const result = await runVitest({
      root: 'fixtures/mocking-unused-factory',
      browser: { importMapMocks },
    })

    onTestFailed(() => {
      console.error(result.stdout)
      console.error(result.stderr)
    })

    expect(result.stderr).toReportNoErrors()
    instances.forEach(({ browser }) => {
      expect(result.stdout).toReportPassedTest('no-import.test.ts', browser)
    })
    expect(existsSync(transformed)).toBe(false)
  },
)
