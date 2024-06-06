import { createDefer } from '@vitest/utils'
import type { Vitest } from '../core'
import type { ProcessPool } from '../pool'
import type { WorkspaceProject } from '../workspace'
import type { BrowserProvider } from '../../types/browser'

export function createBrowserPool(ctx: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const waitForTests = async (contextId: string, project: WorkspaceProject, files: string[]) => {
    const defer = createDefer<void>()
    project.browserState.forEach(state => state.resolve())
    project.browserState.set(contextId, {
      files,
      resolve: () => {
        defer.resolve()
        project.browserState.delete(contextId)
      },
      reject: defer.reject,
    })
    return await defer
  }

  const runTests = async (project: WorkspaceProject, files: string[]) => {
    ctx.state.clearFiles(project, files)
    const mocker = project.browserMocker
    mocker.mocks.forEach((_, id) => {
      mocker.invalidateModuleById(id)
    })
    mocker.mocks.clear()

    // TODO
    // let isCancelled = false
    // project.ctx.onCancel(() => {
    //   isCancelled = true
    // })

    const provider = project.browserProvider!
    providers.add(provider)

    const resolvedUrls = project.browser?.resolvedUrls
    const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0]

    if (!origin)
      throw new Error(`Can't find browser origin URL for project "${project.config.name}"`)

    const contextId = crypto.randomUUID()
    const promise = waitForTests(contextId, project, files)

    // const orchestrators = project.browserRpc.orchestrators
    // TODO: rerun only opened ones
    // expect to have 4 opened pages and distribute tests amongst them
    // if there is a UI, have only a sinle page - or just don't support this in watch mode for now?
    // if (orchestrators.size) {
    //   orchestrators.forEach(orchestrator =>
    //     orchestrator.createTesters(files),
    //   )
    // }
    // else {
    const url = new URL('/', origin)
    url.searchParams.set('contextId', contextId)
    await provider.openPage(url.toString())
    // }

    await promise
  }

  const runWorkspaceTests = async (specs: [WorkspaceProject, string][]) => {
    const groupedFiles = new Map<WorkspaceProject, string[]>()
    for (const [project, file] of specs) {
      const files = groupedFiles.get(project) || []
      files.push(file)
      groupedFiles.set(project, files)
    }

    // TODO: paralellize tests instead of running them sequentially (based on CPU?)
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
