import * as nodeos from 'node:os'
import crypto from 'node:crypto'
import { createDefer } from '@vitest/utils'
import { relative } from 'pathe'
import type { Vitest } from '../core'
import type { ProcessPool } from '../pool'
import type { WorkspaceProject } from '../workspace'
import type { BrowserProvider } from '../../types/browser'
import { createDebugger } from '../../utils/debugger'

const debug = createDebugger('vitest:browser:pool')

export function createBrowserPool(ctx: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const waitForTests = async (
    contextId: string,
    project: WorkspaceProject,
    files: string[],
  ) => {
    const defer = createDefer<void>()
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
    // const mocker = project.browserMocker
    // mocker.mocks.forEach((_, id) => {
    //   mocker.invalidateModuleById(id)
    // })
    // mocker.mocks.clear()

    const threadsCount = getThreadsCount(project)
    // TODO
    // let isCancelled = false
    // project.ctx.onCancel(() => {
    //   isCancelled = true
    // })

    const provider = project.browserProvider!
    providers.add(provider)

    const resolvedUrls = project.browser?.resolvedUrls
    const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0]

    if (!origin) {
      throw new Error(
        `Can't find browser origin URL for project "${project.config.name}"`,
      )
    }

    const filesPerThread = Math.ceil(files.length / threadsCount)

    // TODO: make it smarter,
    // Currently if we run 4/4/4/4 tests, and one of the chunks ends,
    // but there are pending tests in another chunks, we can't redistribute them
    const chunks: string[][] = []
    for (let i = 0; i < files.length; i += filesPerThread) {
      const chunk = files.slice(i, i + filesPerThread)
      chunks.push(chunk)
    }

    debug?.(
      `[%s] Running %s tests in %s chunks (%s threads)`,
      project.getName() || 'core',
      files.length,
      chunks.length,
      threadsCount,
    )

    const orchestrators = [...project.browserRpc.orchestrators.entries()]

    const promises: Promise<void>[] = []

    chunks.forEach((files, index) => {
      if (orchestrators[index]) {
        const [contextId, orchestrator] = orchestrators[index]
        debug?.(
          'Reusing orchestrator (context %s) for files: %s',
          contextId,
          [...files.map(f => relative(project.config.root, f))].join(', '),
        )
        const promise = waitForTests(contextId, project, files)
        promises.push(promise)
        orchestrator.createTesters(files)
      }
      else {
        const contextId = crypto.randomUUID()
        const waitPromise = waitForTests(contextId, project, files)
        debug?.(
          'Opening a new context %s for files: %s',
          contextId,
          [...files.map(f => relative(project.config.root, f))].join(', '),
        )
        const url = new URL('/', origin)
        url.searchParams.set('contextId', contextId)
        const page = provider
          .openPage(contextId, url.toString())
          .then(() => waitPromise)
        promises.push(page)
      }
    })

    await Promise.all(promises)
  }

  const runWorkspaceTests = async (specs: [WorkspaceProject, string][]) => {
    const groupedFiles = new Map<WorkspaceProject, string[]>()
    for (const [project, file] of specs) {
      const files = groupedFiles.get(project) || []
      files.push(file)
      groupedFiles.set(project, files)
    }

    // TODO: paralellize tests instead of running them sequentially (based on CPU?)
    for (const [project, files] of groupedFiles.entries()) {
      await runTests(project, files)
    }
  }

  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  function getThreadsCount(project: WorkspaceProject) {
    const config = project.config.browser
    if (!config.headless || !project.browserProvider!.supportsParallelism) {
      return 1
    }

    if (!config.fileParallelism) {
      return 1
    }

    return ctx.config.watch
      ? Math.max(Math.floor(numCpus / 2), 1)
      : Math.max(numCpus - 1, 1)
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
