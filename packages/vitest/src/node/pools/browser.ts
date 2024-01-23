import { createDefer } from '@vitest/utils'
import { relative } from 'pathe'
import type { Vitest } from '../core'
import type { ProcessPool } from '../pool'
import type { WorkspaceProject } from '../workspace'
import type { BrowserProvider } from '../../types/browser'

export function createBrowserPool(ctx: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const waitForTests = async (id: string, paths: string[]) => {
    const defer = createDefer()
    ctx.state.browserTestMap.set(id, {
      paths,
      resolve: defer.resolve,
      reject: defer.reject,
    })
    return await defer
  }

  const runTests = async (project: WorkspaceProject, files: string[]) => {
    ctx.state.clearFiles(project, files)

    // let isCancelled = false
    // project.ctx.onCancel(() => {
    //   isCancelled = true
    // })

    const provider = project.browserProvider!
    providers.add(provider)

    const resolvedUrls = project.browser?.resolvedUrls
    const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0]

    const id = performance.now().toString()

    const url = new URL('/', origin)
    url.searchParams.set('__vitest_id', id)
    url.searchParams.set('__vitest_length', String(files.length))
    await provider.openPage(url.toString())
    await waitForTests(id, files)

    // if (project.config.browser.isolate) {
    //   for (const path of paths) {
    //     if (isCancelled) {
    //       ctx.state.cancelFiles(files.slice(paths.indexOf(path)), ctx.config.root, project.config.name)
    //       break
    //     }

    //     const url = new URL('/', origin)
    //     url.searchParams.append('path', path)
    //     url.searchParams.set('id', path)
    //     await provider.openPage(url.toString())
    //     await waitForTest(provider, path)
    //   }
    // }
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
      ctx.state.browserTestMap.clear()
      await Promise.all([...providers].map(provider => provider.close()))
      providers.clear()
    },
    runTests: runWorkspaceTests,
  }
}
