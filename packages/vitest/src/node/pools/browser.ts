import type { Context, Span } from '@opentelemetry/api'
import type { DeferPromise } from '@vitest/utils/helpers'
import type { FileSpecification } from '../../runtime/runner/types'
import type { Traces } from '../../utils/traces'
import type { Vitest } from '../core'
import type { ProcessPool } from '../pool'
import type { TestProject } from '../project'
import type { TestSpecification } from '../test-specification'
import type { BrowserProvider } from '../types/browser'
import crypto from 'node:crypto'
import { readFile } from 'node:fs/promises'
import * as nodeos from 'node:os'
import { createDefer } from '@vitest/utils/helpers'
import { stringify } from 'flatted'
import { createDebugger } from '../../utils/debugger'
import { detectCodeBlock } from '../../utils/test-helpers'

const debug = createDebugger('vitest:browser:pool')

export function createBrowserPool(vitest: Vitest): ProcessPool {
  const providers = new Set<BrowserProvider>()

  const numCpus
    = typeof nodeos.availableParallelism === 'function'
      ? nodeos.availableParallelism()
      : nodeos.cpus().length

  // if there are more than ~12 threads (optimistically), the main thread chokes
  // https://github.com/vitest-dev/vitest/issues/7871
  const maxThreadsCount = Math.min(12, numCpus - 1)
  const threadsCount = vitest.config.watch
    ? Math.max(Math.floor(maxThreadsCount / 2), 1)
    : Math.max(maxThreadsCount, 1)

  const projectPools = new WeakMap<TestProject, BrowserPool>()

  const ensurePool = (project: TestProject) => {
    if (projectPools.has(project)) {
      return projectPools.get(project)!
    }

    debug?.('creating pool for project %s', project.name)

    const pool: BrowserPool = new BrowserPool(project, {
      maxWorkers: getThreadsCount(project),
    })
    projectPools.set(project, pool)
    vitest.onCancel(() => {
      pool.cancel()
    })

    return pool
  }

  const runWorkspaceTests = async (method: 'run' | 'collect', specs: TestSpecification[]) => {
    const groupedFiles = new Map<TestProject, FileSpecification[]>()
    const testFilesCode = new Map<string, string>()
    const testFileTags = new WeakMap<TestSpecification, string[]>()

    await Promise.all(specs.map(async (spec) => {
      let code = testFilesCode.get(spec.moduleId)
      // TODO: this really should be done only once when collecting specifications
      if (code == null) {
        code = await readFile(spec.moduleId, 'utf-8').catch(() => '')
        testFilesCode.set(spec.moduleId, code)
      }
      const { tags } = detectCodeBlock(code)
      testFileTags.set(spec, tags)
    }))

    // to keep the sorting, we need to iterate over specs separately
    for (const spec of specs) {
      const { project, moduleId, testLines, testIds, testNamePattern, testTagsFilter } = spec
      const files = groupedFiles.get(project) || []
      files.push({
        filepath: moduleId,
        testLocations: testLines,
        testIds,
        testNamePattern,
        testTagsFilter,
        fileTags: testFileTags.get(spec),
      })
      groupedFiles.set(project, files)
    }

    let isCancelled = false
    vitest.onCancel(() => {
      isCancelled = true
    })

    const initialisedPools = await Promise.all(Array.from(groupedFiles.entries(), async ([project, files]) => {
      await project._initBrowserProvider()

      if (!project.browser) {
        throw new TypeError(`The browser server was not initialized${project.name ? ` for the "${project.name}" project` : ''}. This is a bug in Vitest. Please, open a new issue with reproduction.`)
      }

      if (isCancelled) {
        return
      }

      debug?.('provider is ready for %s project', project.name)

      const pool = ensurePool(project)
      vitest.state.clearFiles(project, files.map(f => f.filepath))
      providers.add(project.browser!.provider)

      return {
        pool,
        provider: project.browser!.provider,
        runTests: () => pool.runTests(method, files),
      }
    }))

    if (isCancelled) {
      return
    }

    const parallelPools: (() => Promise<void>)[] = []
    const nonParallelPools: (() => Promise<void>)[] = []

    for (const pool of initialisedPools) {
      if (!pool) {
        // this means it was cancelled
        return
      }

      if (pool.provider.mocker && pool.provider.supportsParallelism) {
        parallelPools.push(pool.runTests)
      }
      else {
        nonParallelPools.push(pool.runTests)
      }
    }

    await Promise.all(parallelPools.map(runTests => runTests()))

    for (const runTests of nonParallelPools) {
      if (isCancelled) {
        return
      }

      await runTests()
    }
  }

  function getThreadsCount(project: TestProject) {
    const config = project.config.browser
    if (
      !config.headless
      || !project.browser!.provider.supportsParallelism
    ) {
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
      await Promise.all(Array.from(providers, provider => provider.close()))
      vitest._browserSessions.sessionIds.clear()
      providers.clear()
      vitest.projects.forEach((project) => {
        project.browser?.state.orchestrators.forEach((orchestrator) => {
          orchestrator.$close()
        })
      })
      debug?.('browser pool closed all providers')
    },
    runTests: files => runWorkspaceTests('run', files),
    collectTests: files => runWorkspaceTests('collect', files),
  }
}

function escapePathToRegexp(path: string): string {
  return path.replace(/[/\\.?*()^${}|[\]+]/g, '\\$&')
}

class BrowserPool {
  private _queue: FileSpecification[] = []
  private _promise: DeferPromise<void> | undefined
  private _providedContext: string | undefined

  private _scaling: Promise<void> | undefined
  // EMA of how long a single file takes in this pool; undefined until the
  // first file finishes, which means "no signal yet — keep opening sessions"
  private _fileCostEma: number | undefined
  // refined with the real duration after every session open
  private _sessionOpenCost = 250
  // a session's first file pays the tester bootstrap on top of the test
  // itself, so it would wildly overestimate the steady per-file cost
  private _warmedUpSessions = new Set<string>()

  private readySessions: Set<string>

  private _traces: Traces
  private _otel: {
    span: Span
    context: Context
  }

  constructor(
    private project: TestProject,
    private options: {
      maxWorkers: number
    },
  ) {
    this._traces = project.vitest._traces
    this._otel = this._traces.startContextSpan('vitest.browser')
    this._otel.span.setAttributes({
      'vitest.project': project.name,
      'vitest.browser.provider': this.project.browser!.provider.name,
    })
    this.readySessions = project._browserReadySessions
  }

  public cancel(): void {
    this._queue = []
    this._otel.span.end()
  }

  public reject(error: Error): void {
    this._promise?.reject(error)
    this._promise = undefined
    this.cancel()
  }

  get orchestrators() {
    return this.project.browser!.state.orchestrators
  }

  async runTests(method: 'run' | 'collect', files: FileSpecification[]): Promise<void> {
    this._promise ??= createDefer<void>()

    if (!files.length) {
      debug?.('no tests found, finishing test run immediately')
      this._promise.resolve()
      return this._promise
    }

    this._providedContext = stringify(this.project.getProvidedContext())

    this._queue.push(...files)

    this.readySessions.forEach((sessionId) => {
      if (this._queue.length) {
        this.readySessions.delete(sessionId)
        this.runNextTest(method, sessionId)
      }
    })

    if (this.orchestrators.size >= this.options.maxWorkers) {
      debug?.('all orchestrators are ready, not creating more')
      return this._promise
    }

    this.scaleSessions(method)
    return this._promise
  }

  // Sessions are opened one by one while the queue justifies another tab
  // instead of `maxWorkers` tabs upfront: every tab pays a context + page +
  // full module graph bring-up that competes with already-running sessions
  // for the same Vite server, so for fast suites fewer tabs finish sooner.
  private scaleSessions(method: 'run' | 'collect'): void {
    if (this._scaling) {
      return
    }
    this._scaling = (async () => {
      while (
        this._queue.length
        && this.orchestrators.size < this.options.maxWorkers
        && this.shouldOpenAnotherSession()
      ) {
        const sessionId = crypto.randomUUID()
        this.project.vitest._browserSessions.sessionIds.add(sessionId)
        debug?.('[%s] creating session for %s', sessionId, this.project.name)
        const openStart = performance.now()
        await this._traces.$(
          `vitest.browser.open`,
          {
            context: this._otel.context,
            attributes: {
              'vitest.browser.session_id': sessionId,
            },
          },
          () => this.openPage(sessionId, {
            parallel: this.options.maxWorkers > 1
              && this.orchestrators.size + this._queue.length > 1,
          }),
        )
        this._sessionOpenCost = performance.now() - openStart
        // start running tests on the page when it's ready; a failure here
        // already took a file off the queue, so it can never be swallowed
        try {
          this.runNextTest(method, sessionId)
        }
        catch (error) {
          this.reject(error as Error)
          return
        }
      }
      debug?.('finished scaling sessions, %s sessions are running', this.orchestrators.size)
    })()
    this._scaling
      .catch((error) => {
        // a failure to open an extra session when the queue is already
        // drained should not fail the run: the sessions that are still
        // running have their own error and timeout handling
        if (!this._queue.length && this.orchestrators.size > 0) {
          debug?.('failed to open an extra session, ignoring: %s', error)
          return
        }
        this.reject(error as Error)
      })
      .finally(() => {
        this._scaling = undefined
        // completion might have been blocked by the in-flight scaling
        this.checkCompletion()
      })
  }

  private shouldOpenAnotherSession(): boolean {
    // the first session always opens; without a per-file signal
    // keep the old behavior of scaling up to maxWorkers
    if (this.orchestrators.size === 0 || this._fileCostEma == null) {
      return true
    }
    // only pay for another tab when the remaining work, split across the
    // sessions we already have, still takes considerably longer than opening
    // a tab costs — a new tab does not just cost its own bring-up, it also
    // competes with the running sessions for the same Vite server
    const projectedDrainMs
      = (this._queue.length * this._fileCostEma) / this.orchestrators.size
    return projectedDrainMs > Math.max(this._sessionOpenCost, 100) * 2
  }

  private async openPage(sessionId: string, options: { parallel: boolean }): Promise<void> {
    await this.project._openBrowserPage(sessionId, {
      reject: error => this.reject(error),
      parallel: options.parallel,
    })
  }

  // stable slot id (1..maxWorkers) assigned to each session/orchestrator on its
  // first run, exposed to the test runner as both `concurrencyId` and `workerId`.
  // the id lives on the session, so it is freed when the session disconnects, and
  // the used set is derived from the live orchestrators, so it stays within maxWorkers
  private getConcurrencyId(sessionId: string): number {
    const sessions = this.project.vitest._browserSessions
    const session = sessions.getSession(sessionId)
    if (session?.concurrencyId) {
      return session.concurrencyId
    }
    const used = new Set<number>()
    for (const id of this.orchestrators.keys()) {
      const concurrencyId = sessions.getSession(id)?.concurrencyId
      if (concurrencyId) {
        used.add(concurrencyId)
      }
    }
    let concurrencyId = 1
    while (used.has(concurrencyId)) {
      concurrencyId++
    }
    if (session) {
      session.concurrencyId = concurrencyId
    }
    return concurrencyId
  }

  private getOrchestrator(sessionId: string) {
    const orchestrator = this.orchestrators.get(sessionId)
    if (!orchestrator) {
      throw new Error(`Orchestrator not found for session ${sessionId}. This is a bug in Vitest. Please, open a new issue with reproduction.`)
    }
    return orchestrator
  }

  private finishSession(sessionId: string): void {
    this.readySessions.add(sessionId)

    if (!this.checkCompletion()) {
      debug?.(
        `did not finish sessions for ${sessionId}: |ready - %s| |overall - %s|`,
        [...this.readySessions].join(', '),
        [...this.orchestrators.keys()].join(', '),
      )
    }
  }

  private checkCompletion(): boolean {
    // the run already finished (or was rejected) — nothing to resolve
    if (!this._promise) {
      return false
    }
    // the last worker finished running tests; a session that is still
    // opening (this._scaling) will call this again once it settles
    if (!this._scaling && this.readySessions.size === this.orchestrators.size) {
      this._otel.span.end()
      this._promise.resolve()
      this._promise = undefined
      debug?.('all tests finished running')
      return true
    }
    return false
  }

  private runNextTest(method: 'run' | 'collect', sessionId: string): void {
    const file = this._queue.shift()

    if (!file) {
      debug?.('[%s] no more tests to run', sessionId)
      const isolate = this.project.config.isolate
      // we don't need to cleanup testers if isolation is enabled,
      // because cleanup is done at the end of every test
      if (isolate) {
        this.finishSession(sessionId)
        return
      }

      // we need to cleanup testers first because there is only
      // one iframe and it does the cleanup only after everything is completed
      const orchestrator = this.getOrchestrator(sessionId)
      orchestrator.cleanupTesters()
        .catch(error => this.reject(error))
        .finally(() => this.finishSession(sessionId))
      return
    }

    if (!this._promise) {
      throw new Error(`Unexpected empty queue`)
    }

    const orchestrator = this.getOrchestrator(sessionId)
    debug?.('[%s] run test %s', sessionId, file)

    // warm the transform cache while the iframe is booting so the test
    // file import doesn't wait for the transform; mirrors the URL the
    // tester will request (see `importFile` in the browser runner)
    const fileUrl = `/${/^\w:/.test(file.filepath) ? '@fs/' : ''}${file.filepath}`.replace(/\/+/g, '/')
    void this.project.browser?.vite.transformRequest(fileUrl).catch(() => {})

    this.setBreakpoint(sessionId, file.filepath).then(() => {
      const fileStart = performance.now()
      // this starts running tests inside the orchestrator
      const testersPromise = this._traces.$(
        `vitest.browser.run`,
        {
          context: this._otel.context,
          attributes: {
            'code.file.path': file.filepath,
          },
        },
        async () => {
          const concurrencyId = this.getConcurrencyId(sessionId)
          return orchestrator.createTesters(
            {
              method,
              files: [file],
              // this will be parsed by the test iframe, not the orchestrator
              // so we need to stringify it first to avoid double serialization
              providedContext: this._providedContext || '[{}]',
              otelCarrier: this._traces.getContextCarrier(),
              concurrencyId,
              // in the browser there is a single tab per orchestrator,
              // so the worker id matches the concurrency slot
              workerId: concurrencyId,
            },
          )
        },
      )
      testersPromise
        .then(() => {
          if (this._warmedUpSessions.has(sessionId)) {
            const fileCost = performance.now() - fileStart
            this._fileCostEma = this._fileCostEma == null
              ? fileCost
              : this._fileCostEma * 0.7 + fileCost * 0.3
          }
          else {
            this._warmedUpSessions.add(sessionId)
          }
          debug?.('[%s] test %s finished running', sessionId, file)
          this.runNextTest(method, sessionId)
        })
        .catch((error) => {
          // if user cancels the test run manually, ignore the error and exit gracefully
          if (
            this.project.vitest.isCancelling
            && error instanceof Error
            && error.message.startsWith('Browser connection was closed while running tests')
          ) {
            this.cancel()
            this._promise?.resolve()
            this._promise = undefined
            debug?.('[%s] browser connection was closed', sessionId)
            return
          }
          debug?.('[%s] error during %s test run: %s', sessionId, file, error)
          this.reject(
            new Error(`Failed to run the test ${file.filepath}.`, { cause: error }),
          )
        })
    }).catch(err => this.reject(err))
  }

  async setBreakpoint(sessionId: string, file: string) {
    if (!this.project.config.inspector.waitForDebugger) {
      return
    }

    const provider = this.project.browser!.provider
    const browser = this.project.config.browser.name

    if (shouldIgnoreDebugger(provider.name, browser)) {
      debug?.('[$s] ignoring debugger in %s browser because it is not supported', sessionId, browser)
      return
    }

    if (!provider.getCDPSession) {
      throw new Error('Unable to set breakpoint, CDP not supported')
    }

    debug?.('[%s] set breakpoint for %s', sessionId, file)
    const session = await provider.getCDPSession(sessionId)
    await session.send('Debugger.enable', {})
    await session.send('Debugger.setBreakpointByUrl', {
      lineNumber: 0,
      urlRegex: escapePathToRegexp(file),
    })
  }
}

function shouldIgnoreDebugger(provider: string, browser: string) {
  if (provider === 'webdriverio') {
    return browser !== 'chrome' && browser !== 'edge'
  }
  return browser !== 'chromium'
}
