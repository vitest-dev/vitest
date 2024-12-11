import { afterEach, expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

afterEach(() => {
  delete process.env.TEST_HTTPS
})

test('server-url http', async () => {
  const { stderr, ctx } = await runBrowserTests({
    root: './fixtures/server-url',
    watch: true, // otherwise the browser is closed before we can get the url
  })
  const url = ctx?.projects[0].browser?.vite.resolvedUrls?.local[0]
  expect(stderr).toBe('')
  expect(url).toBe('http://localhost:51133/')
})

test('server-url https', async () => {
  process.env.TEST_HTTPS = '1'
  const { stdout, stderr, ctx } = await runBrowserTests({
    root: './fixtures/server-url',
    watch: true, // otherwise the browser is closed before we can get the url
  })
  expect(stderr).toBe('')
  const url = ctx?.projects[0].browser?.vite.resolvedUrls?.local[0]
  expect(url).toBe('https://localhost:51122/')
  expect(stdout).toReportSummaryTestFiles({ passed: instances.length })
})
