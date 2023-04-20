import { createDefer } from '@vitest/utils'
import { relative } from 'pathe'
import { stringify } from 'flatted'
import type { Vitest } from '../core'
import type { ProcessPool } from '../pool'
import type { WorkspaceProject } from '../workspace'
import type { BrowserProvider } from '../../types/browser'
import { WebSocketReporter } from '../../api/setup'

export function createBrowserPool(ctx: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const waitForTest = (id: string) => {
    const defer = createDefer()
    ctx.state.browserTestPromises.set(id, defer)
    return defer
  }

  const runTests = async (project: WorkspaceProject, files: string[]) => {
    const provider = project.browserProvider!
    providers.add(provider)

    const origin = `http://${ctx.config.browser.api?.host || 'localhost'}:${project.browser.config.server.port}`
    const paths = files.map(file => relative(project.config.root, file))

    // const isolate = project.config.isolate
    /* if (isolate) {
      for (const path of paths) {
        const url = new URL('/', origin)
        url.searchParams.append('path', path)
        url.searchParams.set('id', path)
        await provider.openPage(url.toString())
        await waitForTest(path)
      }
    }
    else { */
    const url = new URL('/', origin)
    url.searchParams.set('id', 'no-isolate')
    if (!provider.isOpen()) {
      await provider.openPage(url.toString())
      await project.ctx.browserPromise
    }
    const wsClients = project.ctx.reporters.filter(r => r instanceof WebSocketReporter).flatMap(r => [...(r as WebSocketReporter).clients.keys()])
    const payload = stringify({ event: 'run', paths })
    for (const ws of wsClients)
      ws.send(payload)

    await waitForTest('no-isolate')
  }

  const runWorkspaceTests = async (specs: [WorkspaceProject, string][]) => {
    const groupedFiles = new Map<WorkspaceProject, string[]>()
    for (const [project, file] of specs) {
      const files = groupedFiles.get(project) || []
      files.push(file)
      groupedFiles.set(project, files)
    }

    for (const [project, files] of groupedFiles.entries())
      await runTests(project, files)
  }

  return {
    async close() {
      ctx.state.browserTestPromises.clear()
      await Promise.all([...providers].map(provider => provider.close()))
      providers.clear()
    },
    runTests: runWorkspaceTests,
  }
}
