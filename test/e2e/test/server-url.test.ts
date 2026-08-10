import basicSsl from '@vitejs/plugin-basic-ssl'
import { expect, it } from 'vitest'

import { runInlineTests } from '../../test-utils'

// `api: true` must resolve to the default port, but which port Vite actually
// binds is not asserted: 51204 sits inside the OS ephemeral port range, and
// when an unrelated outbound socket happens to hold it, Vite silently binds
// port+1 (`strictPort` is off and the "Port is in use" notice is info-level,
// below the logger's `warn` level)
it('api server-url http', async () => {
  const { stdout, stderr, ctx } = await runInlineTests(
    { 'basic.test.js': `test("basic")` },
    {
      api: true,
      globals: true,
    },
  )
  expect(stderr).toBe('')
  expect(ctx!.config.api.port).toBe(51204)
  expect(stdout).toMatch(/API started at http:\/\/localhost:\d+\//)
  expect(stdout).toContain('Test Files  1 skipped')
})

it('api server-url https', async () => {
  const { stdout, stderr, ctx } = await runInlineTests(
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
  expect(ctx!.config.api.port).toBe(51204)
  expect(stdout).toMatch(/API started at https:\/\/localhost:\d+\//)
  expect(stdout).toContain('Test Files  1 skipped')
})

it.todo('api server-url fallback if resolvedUrls is null')
