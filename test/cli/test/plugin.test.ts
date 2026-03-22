import { runVitest } from '#test-utils'
import { expect, it } from 'vitest'

it('plugin hooks', async () => {
  await runVitest({ root: './fixtures/plugin' })
  expect((globalThis as any).__testHooks.slice(0, 5)).toEqual(
    [
      'configureServer(pre)',
      'configureServer(default)',
      'buildStart(pre)',
      'buildStart(default)',
      'resolveId(pre)',
    ],
  )
})
