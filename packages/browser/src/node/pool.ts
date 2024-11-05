import type { DeferPromise } from '@vitest/utils'
import type { BrowserProvider, ProcessPool, Vitest, WorkspaceProject, WorkspaceSpec } from 'vitest/node'
import crypto from 'node:crypto'
import * as nodeos from 'node:os'
import { createDefer } from '@vitest/utils'
import { createDebugger } from 'vitest/node'

const debug = createDebugger('vitest:browser:pool')

async function waitForTests(
  method: 'run' | 'collect',
  contextId: string,
  project: WorkspaceProject,
  files: string[],
) {
  const context = project.browser!.state.createAsyncContext(method, contextId, files)
  return await context
}

export function createBrowserPool(ctx: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const executeTests = async (
    defer: DeferPromise<void>,
    method: 'run' | 'collect',
    project: WorkspaceProject,
    files: string[],
  ) => {
    ctx.state.clearFiles(project, files)
    const browser = project.browser!

    const threadsCount = getThreadsCount(project)

    const provider = browser.provider
    providers.add(provider)

    const resolvedUrls = browser.vite.resolvedUrls
    const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0]

    if (!origin) {
      throw new Error(
        `Can't find browser origin URL for project "${project.getName()}" when running tests for files "${files.join('", "')}"`,
      )
    }

    async function setBreakpoint(contextId: string, file: string) {
      if (!project.config.inspector.waitForDebugger) {
        return
      }

      if (!provider.getCDPSession) {
        throw new Error('Unable to set breakpoint, CDP not supported')
      }

      const session = await provider.getCDPSession(contextId)
      await session.send('Debugger.enable', {})
      await session.send('Debugger.setBreakpointByUrl', {
        lineNumber: 0,
        urlRegex: escapePathToRegexp(file),
      })
    }

    const orchestrators = [...browser.state.orchestrators.entries()]

    browser.state.onReady(async (contextId, orchestrator) => {
      const file = files.shift()
      if (!file) {
        browser.state.cleanListeners()
        defer.resolve()
        // No more files to run
        // resolve the context
        return
      }
      waitForTests(method, contextId, project, [file])
      orchestrator.createTesters([file])
    })

    browser.state.onError((_, error) => {
      browser.state.cleanListeners()
      defer.reject(error)
    })

    const startPromises: Promise<void>[] = []

    if (!orchestrators.length) {
      files.splice(0, threadsCount).forEach((file) => {
        const contextId = crypto.randomUUID()
        const waitPromise = waitForTests(method, contextId, project, [file])
        debug?.(
          'Opening a new context %s for files: %s',
          contextId,
          file,
        )
        const url = new URL('/', origin)
        url.searchParams.set('contextId', contextId)
        const page = provider
          .openPage(contextId, url.toString(), () => setBreakpoint(contextId, file))
        startPromises.push(page, waitPromise)
      })
    }

    await Promise.all([
      defer,
      ...startPromises,
    ])
  }

  const runWorkspaceTests = async (method: 'run' | 'collect', specs: WorkspaceSpec[]) => {
    const groupedFiles = new Map<WorkspaceProject, string[]>()
    for (const [project, file] of specs) {
      const files = groupedFiles.get(project) || []
      files.push(file)
      groupedFiles.set(project, files)
    }

    const defer = createDefer<void>()
    ctx.onCancel(() => {
      defer.reject(new Error('Tests cancelled'))
    })

    for (const [project, files] of groupedFiles.entries()) {
      executeTests(defer, method, project, files)
    }

    await defer
  }

  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  function getThreadsCount(project: WorkspaceProject) {
    const config = project.config.browser
    if (!config.headless || !project.browser!.provider.supportsParallelism) {
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
    runTests: files => runWorkspaceTests('run', files),
    collectTests: files => runWorkspaceTests('collect', files),
  }
}

function escapePathToRegexp(path: string): string {
  return path.replace(/[/\\.?*()^${}|[\]+]/g, '\\$&')
}
