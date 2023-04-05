import { createDefer } from '@vitest/utils'
import { relative } from 'pathe'
import type { Vitest } from '../core'
import type { ProcessPool } from '../pool'
import type { VitestWorkspace } from '../workspace'
import type { BrowserProvider } from '../../types/browser'

export function createBrowserPool(ctx: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const waitForTest = (id: string) => {
    const defer = createDefer()
    ctx.state.browserTestPromises.set(id, defer)
    return defer
  }

  const runTests = async (workspace: VitestWorkspace, files: string[]) => {
    const provider = workspace.browserProvider!
    providers.add(provider)

    const origin = `http://${ctx.config.browser.api?.host || 'localhost'}:${workspace.browser.config.server.port}`
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

  const runWorkspaceTests = async (specs: [VitestWorkspace, string][]) => {
    const groupedFiles = new Map<VitestWorkspace, string[]>()
    for (const [workspace, file] of specs) {
      const files = groupedFiles.get(workspace) || []
      files.push(file)
      groupedFiles.set(workspace, files)
    }

    for (const [workspace, files] of groupedFiles.entries())
      await runTests(workspace, files)
  }

  return {
    async close() {
      ctx.state.browserTestPromises.clear()
      await Promise.all([...providers].map(provider => provider.close()))
    },
    runTests: runWorkspaceTests,
  }
}
