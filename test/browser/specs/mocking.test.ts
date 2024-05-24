import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'
import { runBrowserTests } from './utils'

test.each([true, false])('mocking works correctly - isolated %s', async (isolate) => {
  const result = await runVitest({
    root: 'fixtures/mocking',
    isolate,
  })
  expect(result.stderr).toBe('')
  expect(result.stdout).toContain('automocked.test')
  expect(result.stdout).toContain('mocked-__mocks__')
  expect(result.stdout).toContain('mocked-factory')
  expect(result.stdout).toContain('mocked-factory-hoisted')
  expect(result.stdout).toContain('not-mocked')
  expect(result.exitCode).toBe(0)
})

test('mocking fails if fileParallelism is enabled', async () => {
  const result = await runBrowserTests({
    root: 'fixtures/mocking',
    browser: {
      fileParallelism: true,
    },
  })
  expect(result.stderr).toContain('Mocking doesn\'t work with "browser.fileParallelism" enabled')
  expect(result.exitCode).toBe(1)
})
