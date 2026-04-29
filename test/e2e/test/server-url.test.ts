import basicSsl from '@vitejs/plugin-basic-ssl'
import { expect, it } from 'vitest'

import { runInlineTests } from '../../test-utils'

it('api server-url http', async () => {
  const { stdout, stderr } = await runInlineTests(
    { 'basic.test.js': `test("basic")` },
    {
      api: true,
      globals: true,
    },
  )
  expect(stderr).toBe('')
  expect(stdout).toContain('API started at http://localhost:51204/')
  expect(stdout).toContain('Test Files  1 skipped')
})

it('api server-url https', async () => {
  const { stdout, stderr } = await runInlineTests(
    { 'basic.test.js': `test("basic")` },
    {
      api: true,
      globals: true,
      $viteConfig: {
        plugins: [basicSsl()],
      },
    },
  )
  expect(stderr).toBe('')
  expect(stdout).toContain('API started at https://localhost:51204/')
  expect(stdout).toContain('Test Files  1 skipped')
})

it.todo('api server-url fallback if resolvedUrls is null')
