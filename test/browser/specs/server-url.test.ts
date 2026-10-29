import { afterEach, expect, test } from 'vitest'
import { defaultBrowserPort } from 'vitest/config'
import { instances, runBrowserTests, runInlineBrowserTests } from './utils'

afterEach(() => {
  delete process.env.TEST_HTTPS
})

test('server-url http', async () => {
  const { stderr, ctx } = await runBrowserTests({
    root: './fixtures/server-url',
    watch: true, // otherwise the browser is closed before we can get the url
  })
  const url = ctx?.projects[0].vite.resolvedUrls?.local[0]
  expect(stderr).toBe('')
  expect.assert(url)
  expect(new URL(url).port).toBe('31133')
})

test('server-url https', async () => {
  process.env.TEST_HTTPS = '1'
  const { stdout, stderr, ctx } = await runBrowserTests({
    root: './fixtures/server-url',
    watch: true, // otherwise the browser is closed before we can get the url
  })
  expect(stderr).toBe('')
  const url = ctx?.projects[0].vite.resolvedUrls?.local[0]
  expect.assert(url)
  expect(new URL(url).port).toBe('31122')
  expect(stdout).toReportSummaryTestFiles({ passed: instances.length })
})

test('server-url port 0', async () => {
  const { stderr, ctx } = await runInlineBrowserTests(
    { 'basic.test.ts': `test('basic', () => {})` },
    { api: { port: 0 }, globals: true, watch: true },
  )
  expect(stderr).toBe('')
  const url = ctx?.projects[0].vite.resolvedUrls?.local[0]
  expect.assert(url)
  // Vite 8.2.1+ binds an OS-assigned port, older Vite binds 5173
  expect(new URL(url).port).not.toBe(String(defaultBrowserPort))
})
