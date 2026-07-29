import type { Vitest } from 'vitest/node'
import { resolve } from 'pathe'

import { expect, it, onTestFinished, vi } from 'vitest'
import { runVitest } from '../../test-utils'

it('automatically assigns the port', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/browser-multiple')
  const spy = vi.spyOn(console, 'log')
  onTestFinished(() => spy.mockRestore())
  let ctx: Vitest
  let urls: (string | undefined)[] = []
  const { stderr } = await runVitest({
    root,
    dir: root,
    watch: false,
    reporters: [
      {
        onInit(ctx_) {
          ctx = ctx_
        },
        onTestRunEnd() {
          urls = ctx.projects.map(p => p.browser?.vite.resolvedUrls?.local[0])
        },
      },
    ],
  })

  expect(spy).not.toHaveBeenCalled()
  expect(stderr).not.toContain('is in use, trying another one...')
  expect(urls).toContain('http://localhost:63315/')
  expect(urls).toContain('http://localhost:63316/')
})
