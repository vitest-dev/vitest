import { resolve } from 'pathe'
import { expect, it, onTestFinished, vi } from 'vitest'

import { runVitest } from '../../test-utils'

it('automatically assigns the port', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/browser-multiple')
  const workspace = resolve(import.meta.dirname, '../fixtures/browser-multiple/vitest.workspace.ts')
  const spy = vi.spyOn(console, 'log')
  onTestFinished(() => spy.mockRestore())
  const { stderr, ctx } = await runVitest({
    root,
    workspace,
    dir: root,
    watch: true,
  })
  const urls = ctx?.projects.map(p => p.browser?.vite.resolvedUrls?.local[0])

  expect(spy).not.toHaveBeenCalled()
  expect(stderr).not.toContain('is in use, trying another one...')
  expect(urls).toEqual([
    'http://localhost:63315/',
    'http://localhost:63316/',
  ])
})
