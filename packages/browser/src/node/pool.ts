import type { DeferPromise } from '@vitest/utils'
import type {
  BrowserProvider,
  ProcessPool,
  TestProject,
  TestSpecification,
  Vitest,
} from 'vitest/node'
import crypto from 'node:crypto'
import * as nodeos from 'node:os'
import { createDefer } from '@vitest/utils'
// import { relative } from 'pathe'
// import { createDebugger } from 'vitest/node'

// const debug = createDebugger('vitest:browser:pool')

async function waitForOrchestrator(
  sessionId: string,
  project: TestProject,
) {
  const context = project.vitest._browserSessions.createSession(sessionId, project)
  return await context
}

// TODO: support breakpoints
// async function setBreakpoint(project: TestProject, sessionId: string, file: string) {
//   if (!project.config.inspector.waitForDebugger) {
//     return
//   }

//   const provider = project.browser!.provider

//   if (!provider.getCDPSession) {
//     throw new Error('Unable to set breakpoint, CDP not supported')
//   }

//   const session = await provider.getCDPSession(sessionId)
//   await session.send('Debugger.enable', {})
//   await session.send('Debugger.setBreakpointByUrl', {
//     lineNumber: 0,
//     urlRegex: escapePathToRegexp(file),
//   })
// }

export function createBrowserPool(vitest: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  const threadsCount = vitest.config.watch
    ? Math.max(Math.floor(numCpus / 2), 1)
    : Math.max(numCpus - 1, 1)

  const executeTests = async (
    method: 'run' | 'collect',
    pool: BrowserPool,
    project: TestProject,
    files: string[],
  ) => {
    vitest.state.clearFiles(project, files)
    providers.add(project.browser!.provider)

    await pool.runTests(method, files)
  }

  const projectPools = new WeakMap<TestProject, BrowserPool>()

  const ensurePool = (project: TestProject) => {
    if (projectPools.has(project)) {
      return projectPools.get(project)!
    }

    const resolvedUrls = project.browser!.vite.resolvedUrls
    const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0]

    if (!origin) {
      throw new Error(
        `Can't find browser origin URL for project "${project.name}"`,
      )
    }

    const pool = new BrowserPool(project, {
      maxWorkers: getThreadsCount(project),
      origin,
      worker: sessionId => waitForOrchestrator(sessionId, project),
    })
    projectPools.set(project, pool)
    vitest.onCancel(() => {
      pool.cancel()
    })

    return pool
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

    // TODO: this might now be a good idea... should we run these in chunks?
    await Promise.all(
      [...groupedFiles.entries()].map(async ([project, files]) => {
        if (isCancelled) {
          return
        }
        await project._initBrowserProvider()

        if (!project.browser) {
          throw new TypeError(`The browser server was not initialized${project.name ? ` for the "${project.name}" project` : ''}. This is a bug in Vitest. Please, open a new issue with reproduction.`)
        }

        if (isCancelled) {
          return
        }

        const pool = ensurePool(project)
        await executeTests(method, pool, project, files)
      }),
    )
  }

  function getThreadsCount(project: TestProject) {
    const config = project.config.browser
    if (!config.headless || !project.browser!.provider.supportsParallelism) {
      return 1
    }

    if (!config.fileParallelism) {
      return 1
    }

    if (project.config.maxWorkers) {
      return project.config.maxWorkers
    }

    return threadsCount
  }

  return {
    name: 'browser',
    async close() {
      await Promise.all([...providers].map(provider => provider.close()))
      providers.clear()
      vitest.projects.forEach((project) => {
        project.browser?.state.orchestrators.forEach((orchestrator) => {
          orchestrator.$close()
        })
      })
    },
    runTests: files => runWorkspaceTests('run', files),
    collectTests: files => runWorkspaceTests('collect', files),
  }
}

// function escapePathToRegexp(path: string): string {
//   return path.replace(/[/\\.?*()^${}|[\]+]/g, '\\$&')
// }

class BrowserPool {
  private _queue: string[] = []
  private _promise: DeferPromise<void> | undefined

  private readySessions = new Set<string>()

  constructor(
    private project: TestProject,
    private options: {
      maxWorkers: number
      origin: string
      worker: (sessionId: string) => Promise<void>
    },
  ) {}

  cancel() {
    this._queue = []
  }

  get orchestrators() {
    return this.project.browser!.state.orchestrators
  }

  // open "maxWothers" browser contexts
  async runTests(method: 'run' | 'collect', files: string[]) {
    this._promise ??= createDefer<void>()

    if (!files.length) {
      this._promise.resolve()
      return this._promise
    }

    this._queue.push(...files)

    this.readySessions.forEach((sessionId) => {
      if (this._queue.length) {
        this.readySessions.delete(sessionId)
        this.runNextTest(method, sessionId)
      }
    })

    if (this.orchestrators.size >= this.options.maxWorkers) {
      return this._promise
    }

    // open the minimum amount of tabs
    // if there is only 1 file running, we don't need 8 tabs running
    const workerCount = Math.min(
      this.options.maxWorkers - this.orchestrators.size,
      files.length,
    )

    const promises: Promise<void>[] = []
    for (let i = 0; i < workerCount; i++) {
      const sessionId = crypto.randomUUID()
      const page = this.openPage(sessionId).then(() => {
        // start running tests on the page when it's ready
        this.runNextTest(method, sessionId)
      })
      promises.push(page)
    }
    await Promise.all(promises)
    return this._promise
  }

  private async openPage(sessionId: string) {
    const promise = this.options.worker(sessionId)
    const url = new URL('/', this.options.origin)
    url.searchParams.set('sessionId', sessionId)
    const page = this.project.browser!.provider.openPage(sessionId, url.toString())
    await Promise.all([promise, page])
  }

  private runNextTest(method: 'run' | 'collect', sessionId: string) {
    const file = this._queue.shift()
    if (!file) {
      this.readySessions.add(sessionId)
      // the last worker finished running tests
      if (this.readySessions.size === this.orchestrators.size) {
        this._promise?.resolve()
        this._promise = undefined
      }
      return
    }
    if (!this._promise) {
      throw new Error(`Unexpected empty queue`)
    }
    const orchestrator = this.orchestrators.get(sessionId)
    if (!orchestrator) {
      // TODO: handle this error
      this._promise.reject(
        new Error(`Orchestrator not found for session ${sessionId}`),
      )
      return
    }

    orchestrator.createTesters(method, [file])
      .then(() => {
        this.runNextTest(method, sessionId)
      })
      .catch((error) => {
        if (error instanceof Error && error.message.startsWith('[birpc] rpc is closed')) {
          return
        }
        this._promise?.reject(error)
      })
  }

  // TODO: isolate: false
}
