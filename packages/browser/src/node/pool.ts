import * as nodeos from 'node:os'
import crypto from 'node:crypto'
import { relative } from 'pathe'
import type { BrowserProvider, ProcessPool, Vitest, WorkspaceProject, WorkspaceSpec } from 'vitest/node'
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

  const executeTests = async (method: 'run' | 'collect', project: WorkspaceProject, files: string[]) => {
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

    const orchestrators = [...browser.state.orchestrators.entries()]

    const promises: Promise<void>[] = []

    chunks.forEach((files, index) => {
      if (orchestrators[index]) {
        const [contextId, orchestrator] = orchestrators[index]
        debug?.(
          'Reusing orchestrator (context %s) for files: %s',
          contextId,
          [...files.map(f => relative(project.config.root, f))].join(', '),
        )
        const promise = waitForTests(method, contextId, project, files)
        promises.push(promise)
        orchestrator.createTesters(files)
      }
      else {
        const contextId = crypto.randomUUID()
        const waitPromise = waitForTests(method, contextId, project, files)
        debug?.(
          'Opening a new context %s for files: %s',
          contextId,
          [...files.map(f => relative(project.config.root, f))].join(', '),
        )
        const url = new URL('/', origin)
        url.searchParams.set('contextId', contextId)
        const page = provider
          .openPage(contextId, url.toString(), () => setBreakpoint(contextId, files[0]))
        promises.push(page, waitPromise)
      }
    })

    await Promise.all(promises)
  }

  const runWorkspaceTests = async (method: 'run' | 'collect', specs: WorkspaceSpec[]) => {
    const groupedFiles = new Map<WorkspaceProject, string[]>()
    for (const [project, file] of specs) {
      const files = groupedFiles.get(project) || []
      files.push(file)
      groupedFiles.set(project, files)
    }

    let isCancelled = false
    ctx.onCancel(() => {
      isCancelled = true
    })

    // TODO: paralellize tests instead of running them sequentially (based on CPU?)
    for (const [project, files] of groupedFiles.entries()) {
      if (isCancelled) {
        break
      }

      await executeTests(method, project, files)
    }
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
