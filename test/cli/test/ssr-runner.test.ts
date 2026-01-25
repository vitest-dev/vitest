import { version } from 'vite'
import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

// https://github.com/vitest-dev/vitest/issues/9324
it('ssr runner.import() works in configureServer', async () => {
  await runVitest({ root: './fixtures/ssr-runner' })
  expect((globalThis as any).__testSsrRunner).toBe(version)
})
