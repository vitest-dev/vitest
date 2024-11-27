import type { Vitest } from 'vitest/node'
import { resolve } from 'pathe'

import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('automatically assigns the port', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/browser-multiple')
  const workspace = resolve(import.meta.dirname, '../fixtures/browser-multiple/vitest.workspace.ts')
  let ctx: Vitest
  let urls: (string | undefined)[] = []
  const { stdout, stderr } = await runVitest({
    root,
    workspace,
    dir: root,
    watch: false,
    reporters: [
      {
        onInit(ctx_) {
          ctx = ctx_
          // patch _browserLastPort to conflicting default 63315 with other tests
          ctx._browserLastPort = 33445
        },
        onFinished() {
          urls = ctx.projects.map(p => p.browser?.vite.resolvedUrls?.local[0])
        },
      },
    ],
  })

  expect(stdout).not.toContain('is in use, trying another one...')
  expect(stderr).not.toContain('is in use, trying another one...')
  expect(urls).toContain('http://localhost:33445/')
  expect(urls).toContain('http://localhost:33446/')
})
