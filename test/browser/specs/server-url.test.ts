import { afterEach, expect, test } from 'vitest'
import { runBrowserTests } from './utils'

afterEach(() => {
  delete process.env.TEST_HTTPS
})

test('server-url http', async () => {
  const { stdout, stderr, provider } = await runBrowserTests({
    root: './fixtures/server-url',
  })
  expect(stderr).toBe('')
  expect(stdout).toContain(`Browser runner started by ${provider} at http://localhost:5173/`)
})

test('server-url https', async () => {
  process.env.TEST_HTTPS = '1'
  const { stdout, stderr, provider } = await runBrowserTests({
    root: './fixtures/server-url',
  })
  expect(stderr).toBe('')
  expect(stdout).toContain(`Browser runner started by ${provider} at https://localhost:5173/`)
  expect(stdout).toContain('Test Files  1 passed')
})
