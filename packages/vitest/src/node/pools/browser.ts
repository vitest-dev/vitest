import { createDefer } from '@vitest/utils'
import { relative } from 'pathe'
import type { Vitest } from '../core'
import type { ProcessPool } from '../pool'
import type { VitestWorkspace } from '../workspace'

export function createBrowserPool(ctx: Vitest): ProcessPool {
  const provider = ctx.browserProvider!
  const origin = `http://${ctx.config.browser.api?.host || 'localhost'}:${ctx.browser.config.server.port}`

  const waitForTest = (id: string) => {
    const defer = createDefer()
    ctx.state.browserTestPromises.set(id, defer)
    return defer
  }

  const runTests = async (workspace: VitestWorkspace, files: string[]) => {
    const paths = files.map(file => relative(workspace.config.root, file))

    const isolate = workspace.config.isolate
    if (isolate) {
      for (const path of paths) {
        const url = new URL('/', origin)
        url.searchParams.append('path', path)
        url.searchParams.set('id', path)
        await provider.openPage(url.toString())
        await waitForTest(path)
      }
    }
    else {
      const url = new URL('/', origin)
      url.searchParams.set('id', 'no-isolate')
      paths.forEach(path => url.searchParams.append('path', path))
      await provider.openPage(url.toString())
      await waitForTest('no-isolate')
    }
  }

  const runWorkspaceTests = async (specs: [VitestWorkspace, string[]][]) => {
    for (const [workspace, files] of specs)
      await runTests(workspace, files)
  }

  return {
    async close() {
      ctx.state.browserTestPromises.clear()
      await provider.close()
    },
    runTests: runWorkspaceTests,
  }
}
