import { expect, onTestFailed, onTestFinished, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'
import { instances } from '../settings'

test.each([true, false])('mocking works correctly - isolated %s', async (isolate) => {
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
    expect(result.stdout).toReportPassedTest('mocked-__mocks__.test.ts', browser)
    expect(result.stdout).toReportPassedTest('mocked-factory.test.ts', browser)
    expect(result.stdout).toReportPassedTest('mocked-factory-hoisted.test.ts', browser)
    expect(result.stdout).toReportPassedTest('not-mocked.test.ts', browser)
    expect(result.stdout).toReportPassedTest('mocked-nested.test.ts', browser)
    expect(result.stdout).toReportPassedTest('not-mocked-nested.test.ts', browser)
    expect(result.stdout).toReportPassedTest('import-actual-in-mock.test.ts', browser)
    expect(result.stdout).toReportPassedTest('import-actual-query.test.ts', browser)
    expect(result.stdout).toReportPassedTest('import-mock.test.ts', browser)
    expect(result.stdout).toReportPassedTest('mocked-do-mock-factory.test.ts', browser)
    expect(result.stdout).toReportPassedTest('import-actual-dep.test.ts', browser)
  })

  expect(result.exitCode).toBe(0)
})

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
  editFile('./fixtures/mocking-watch/1_mocked-on-watch-change.test.ts', content => `${content}\n`)

  await vitest.waitForStdout('Waiting for file changes...')

  expect(vitest.stderr).toReportNoErrors()

  instances.forEach(({ browser }) => {
    expect(vitest.stdout).toReportPassedTest('1_mocked-on-watch-change.test.ts', browser)
    expect(vitest.stdout).not.toReportPassedTest('2_not-mocked-import.test.ts', browser)
  })
})
