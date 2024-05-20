import { createDefer } from '@vitest/utils'
import type { Vitest } from '../core'
import type { ProcessPool, WorkspaceSpec } from '../pool'
import type { WorkspaceProject } from '../workspace'
import type { BrowserProvider } from '../../types/browser'

export function createBrowserPool(ctx: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const waitForTests = async (project: WorkspaceProject, files: string[]) => {
    const defer = createDefer<void>()
    project.browser!.state?.resolve()
    project.browser!.state = {
      files,
      resolve: () => {
        defer.resolve()
        if (project.browser)
          project.browser.state = undefined
      },
      reject: defer.reject,
    }
    return await defer
  }

  const runTests = async (project: WorkspaceProject, files: string[]) => {
    ctx.state.clearFiles(project, files)

    // TODO
    // let isCancelled = false
    // project.ctx.onCancel(() => {
    //   isCancelled = true
    // })

    const provider = project.browser!.provider
    providers.add(provider)

    const resolvedUrls = project.browser!.server.resolvedUrls
    const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0]

    if (!origin)
      throw new Error(`Can't find browser origin URL for project "${project.config.name}"`)

    const promise = waitForTests(project, files)

    await provider.openPage(new URL('/', origin).toString())
    await promise
  }

  const runWorkspaceTests = async (specs: WorkspaceSpec[]) => {
    const groupedFiles = new Map<WorkspaceProject, string[]>()
    for (const { project, file } of specs) {
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
      await Promise.all([...providers].map(provider => provider.close()))
      providers.clear()
    },
    runTests: runWorkspaceTests,
  }
}
