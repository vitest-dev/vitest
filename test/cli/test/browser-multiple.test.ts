import type { Vitest } from 'vitest/node'
import { resolve } from 'pathe'

import { expect, it, onTestFinished, vi } from 'vitest'
import { runVitest } from '../../test-utils'

it('automatically assigns the port', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/browser-multiple')
  const workspace = resolve(import.meta.dirname, '../fixtures/browser-multiple/vitest.workspace.ts')
  const spy = vi.spyOn(console, 'log')
  onTestFinished(() => spy.mockRestore())
  let ctx: Vitest
  let urls: (string | undefined)[] = []
  // override default port since it can conflicts with
  // other browser mode tests in test/cli suite
  process.env.__VITEST_TEST_BROWSER_DEFAULT_PORT__ = '63210'
  const { stderr } = await runVitest({
    root,
    workspace,
    dir: root,
    watch: false,
    reporters: [
      {
        onInit(ctx_) {
          ctx = ctx_
        },
        onFinished() {
          urls = ctx.projects.map(p => p.browser?.vite.resolvedUrls?.local[0])
        },
      },
    ],
  })

  expect(spy).not.toHaveBeenCalled()
  expect(stderr).not.toContain('is in use, trying another one...')
  expect(urls).toContain('http://localhost:63210/')
  expect(urls).toContain('http://localhost:63211/')
})
