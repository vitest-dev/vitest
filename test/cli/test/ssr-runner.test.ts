import { version } from 'vite'
import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

// https://github.com/vitest-dev/vitest/issues/9324
it('ssr runner.import() works in configureServer', async () => {
  const { stderr } = await runVitest({ root: './fixtures/ssr-runner' })
  expect(stderr).toBe('')
  expect((globalThis as any).__testSsrRunner).toBe(version)
})

it('works in project', async () => {
  const { stderr } = await runVitest({ root: './fixtures/ssr-runner-project' })
  expect(stderr).toBe('')
  expect((globalThis as any).__testSsrRunnerProject).toBe(version)
})
