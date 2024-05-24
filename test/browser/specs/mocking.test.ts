import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'
import { runBrowserTests } from './utils'

test('mocking works correctly', async () => {
  const result = await runVitest({
    root: 'fixtures/mocking',
  })
  expect(result.stderr).toBe('')
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
