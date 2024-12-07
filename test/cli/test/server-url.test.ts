import { expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

it('api server-url http', async () => {
  delete process.env.TEST_HTTPS
  const { stdout, stderr } = await runVitest({ root: './fixtures/ws-server-url', api: true })
  expect(stderr).toBe('')
  expect(stdout).toContain('API started at http://localhost:51204/')
  expect(stdout).toContain('Test Files  1 passed')
})

it('api server-url https', async () => {
  process.env.TEST_HTTPS = '1'
  const { stdout, stderr } = await runVitest({ root: './fixtures/ws-server-url', api: true })
  expect(stderr).toBe('')
  expect(stdout).toContain('API started at https://localhost:51204/')
  expect(stdout).toContain('Test Files  1 passed')
})

it.todo('api server-url fallback if resolvedUrls is null')
