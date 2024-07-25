import { expect, onTestFailed, onTestFinished, test } from 'vitest'
import { editFile, runVitest } from '../../test-utils'

test.each([true, false])('mocking works correctly - isolated %s', async (isolate) => {
  const result = await runVitest({
    root: 'fixtures/mocking',
    isolate,
  })

  onTestFailed(() => {
    console.error(result.stdout)
    console.error(result.stderr)
  })

  expect(result.stderr).toBe('')
  expect(result.stdout).toContain('automocked.test.ts')
  expect(result.stdout).toContain('mocked-__mocks__.test.ts')
  expect(result.stdout).toContain('mocked-factory.test.ts')
  expect(result.stdout).toContain('mocked-factory-hoisted.test.ts')
  expect(result.stdout).toContain('not-mocked.test.ts')
  expect(result.stdout).toContain('mocked-nested.test.ts')
  expect(result.stdout).toContain('not-mocked-nested.test.ts')
  expect(result.stdout).toContain('import-actual-in-mock.test.ts')
  expect(result.stdout).toContain('import-actual-query.test.ts')
  expect(result.stdout).toContain('import-mock.test.ts')
  expect(result.stdout).toContain('mocked-do-mock-factory.test.ts')
  expect(result.stdout).toContain('import-actual-dep.test.ts')
  expect(result.exitCode).toBe(0)
})

test('mocking dependency correctly invalidates it on rerun', async () => {
  const { vitest, ctx } = await runVitest({
    root: 'fixtures/mocking-watch',
    watch: true,
  })
  onTestFinished(async () => {
    await ctx.close()
    await ctx.closingPromise
  })

  await vitest.waitForStdout('Waiting for file changes...')

  expect(vitest.stderr).toBe('')
  expect(vitest.stdout).toContain('1_mocked-on-watch-change.test.ts')
  expect(vitest.stdout).toContain('2_not-mocked-import.test.ts')

  vitest.resetOutput()
  editFile('./fixtures/mocking-watch/1_mocked-on-watch-change.test.ts', content => `${content}\n`)

  await vitest.waitForStdout('Waiting for file changes...')

  expect(vitest.stderr).toBe('')
  expect(vitest.stdout).toContain('1_mocked-on-watch-change.test.ts')
  expect(vitest.stdout).not.toContain('2_not-mocked-import.test.ts')
})
