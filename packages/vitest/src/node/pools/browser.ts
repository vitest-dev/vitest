import { createDefer } from '@vitest/utils'
import { relative } from 'pathe'
import type { Vitest } from '../core'
import type { ProcessPool } from '../pool'
import type { WorkspaceProject } from '../workspace'
import type { BrowserProvider } from '../../types/browser'

export function createBrowserPool(ctx: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const waitForTest = async (provider: BrowserProvider, id: string) => {
    const defer = createDefer()
    ctx.state.browserTestPromises.set(id, defer)
    const off = provider.catchError((error) => {
      if (id !== 'no-isolate') {
        Object.defineProperty(error, 'VITEST_TEST_PATH', {
          value: id,
        })
      }
      defer.reject(error)
    })
    try {
      return await defer
    }
    finally {
      off()
    }
  }

  const runTests = async (project: WorkspaceProject, files: string[]) => {
    ctx.state.clearFiles(project, files)

    let isCancelled = false
    project.ctx.onCancel(() => {
      isCancelled = true
    })

    const provider = project.browserProvider!
    providers.add(provider)

    const origin = `http://${ctx.config.browser.api?.host || 'localhost'}:${project.browser!.config.server.port}`
    const paths = files.map(file => relative(project.config.root, file))

    if (project.config.browser.isolate) {
      for (const path of paths) {
        if (isCancelled) {
          ctx.state.cancelFiles(files.slice(paths.indexOf(path)), ctx.config.root, project.config.name)
          break
        }

        const url = new URL('/', origin)
        url.searchParams.append('path', path)
        url.searchParams.set('id', path)
        await provider.openPage(url.toString())
        await waitForTest(provider, path)
      }
    }
    else {
      const url = new URL('/', origin)
      url.searchParams.set('id', 'no-isolate')
      paths.forEach(path => url.searchParams.append('path', path))
      await provider.openPage(url.toString())
      await waitForTest(provider, 'no-isolate')
    }
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
    name: 'browser',
    async close() {
      ctx.state.browserTestPromises.clear()
      await Promise.all([...providers].map(provider => provider.close()))
      providers.clear()
    },
    runTests: runWorkspaceTests,
  }
}
