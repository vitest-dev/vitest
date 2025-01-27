import type { BrowserProvider, ProcessPool, TestProject, TestSpecification, Vitest } from 'vitest/node'
import crypto from 'node:crypto'
import * as nodeos from 'node:os'
import { relative } from 'pathe'
import { createDebugger } from 'vitest/node'

const debug = createDebugger('vitest:browser:pool')

async function waitForTests(
  method: 'run' | 'collect',
  sessionId: string,
  project: TestProject,
  files: string[],
) {
  const context = project.vitest._browserSessions.createAsyncSession(method, sessionId, files, project)
  return await context
}

export function createBrowserPool(vitest: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const executeTests = async (method: 'run' | 'collect', project: TestProject, files: string[]) => {
    vitest.state.clearFiles(project, files)
    const browser = project.browser!

    const threadsCount = getThreadsCount(project)

    const provider = browser.provider
    providers.add(provider)

    const resolvedUrls = browser.vite.resolvedUrls
    const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0]

    if (!origin) {
      throw new Error(
        `Can't find browser origin URL for project "${project.name}" when running tests for files "${files.join('", "')}"`,
      )
    }

    async function setBreakpoint(sessionId: string, file: string) {
      if (!project.config.inspector.waitForDebugger) {
        return
      }

      if (!provider.getCDPSession) {
        throw new Error('Unable to set breakpoint, CDP not supported')
      }

      const session = await provider.getCDPSession(sessionId)
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
      project.name || 'core',
      files.length,
      chunks.length,
      threadsCount,
    )

    const orchestrators = [...browser.state.orchestrators.entries()]

    const promises: Promise<void>[] = []

    chunks.forEach((files, index) => {
      if (orchestrators[index]) {
        const [sessionId, orchestrator] = orchestrators[index]
        debug?.(
          'Reusing orchestrator (session %s) for files: %s',
          sessionId,
          [...files.map(f => relative(project.config.root, f))].join(', '),
        )
        const promise = waitForTests(method, sessionId, project, files)
        const tester = orchestrator.createTesters(files).catch((error) => {
          if (error instanceof Error && error.message.startsWith('[birpc] rpc is closed')) {
            return
          }
          return Promise.reject(error)
        })
        promises.push(promise, tester)
      }
      else {
        const sessionId = crypto.randomUUID()
        const waitPromise = waitForTests(method, sessionId, project, files)
        debug?.(
          'Opening a new session %s for files: %s',
          sessionId,
          [...files.map(f => relative(project.config.root, f))].join(', '),
        )
        const url = new URL('/', origin)
        url.searchParams.set('sessionId', sessionId)
        const page = provider
          .openPage(sessionId, url.toString(), () => setBreakpoint(sessionId, files[0]))
        promises.push(page, waitPromise)
      }
    })

    await Promise.all(promises)
  }

  const runWorkspaceTests = async (method: 'run' | 'collect', specs: TestSpecification[]) => {
    const groupedFiles = new Map<TestProject, string[]>()
    for (const { project, moduleId } of specs) {
      const files = groupedFiles.get(project) || []
      files.push(moduleId)
      groupedFiles.set(project, files)
    }

    let isCancelled = false
    vitest.onCancel(() => {
      isCancelled = true
    })

    // TODO: parallelize tests instead of running them sequentially (based on CPU?)
    for (const [project, files] of groupedFiles.entries()) {
      if (isCancelled) {
        break
      }
      await project._initBrowserProvider()

      if (!project.browser) {
        throw new TypeError(`The browser server was not initialized${project.name ? ` for the "${project.name}" project` : ''}. This is a bug in Vitest. Please, open a new issue with reproduction.`)
      }
      await executeTests(method, project, files)
    }
  }

  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  function getThreadsCount(project: TestProject) {
    const config = project.config.browser
    if (!config.headless || !project.browser!.provider.supportsParallelism) {
      return 1
    }

    if (!config.fileParallelism) {
      return 1
    }

    return vitest.config.watch
      ? Math.max(Math.floor(numCpus / 2), 1)
      : Math.max(numCpus - 1, 1)
  }

  return {
    name: 'browser',
    async close() {
      await Promise.all([...providers].map(provider => provider.close()))
      providers.clear()
      vitest.resolvedProjects.forEach((project) => {
        project.browser?.state.orchestrators.forEach((orchestrator) => {
          orchestrator.$close()
        })
      })
    },
    runTests: files => runWorkspaceTests('run', files),
    collectTests: files => runWorkspaceTests('collect', files),
  }
}

function escapePathToRegexp(path: string): string {
  return path.replace(/[/\\.?*()^${}|[\]+]/g, '\\$&')
}
