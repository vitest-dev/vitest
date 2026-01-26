import type { Context, Span } from '@opentelemetry/api'
import type { FileSpecification } from '@vitest/runner'
import type { DeferPromise } from '@vitest/utils/helpers'
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

    const resolvedUrls = project.browser!.vite.resolvedUrls
    const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0]

    if (!origin) {
      throw new Error(
        `Can't find browser origin URL for project "${project.name}"`,
      )
    }

    const pool: BrowserPool = new BrowserPool(project, {
      maxWorkers: getThreadsCount(project),
      origin,
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

    const initialisedPools = await Promise.all([...groupedFiles.entries()].map(async ([project, files]) => {
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
      || !config.fileParallelism
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
      await Promise.all([...providers].map(provider => provider.close()))
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

  private readySessions = new Set<string>()

  private _traces: Traces
  private _otel: {
    span: Span
    context: Context
  }

  constructor(
    private project: TestProject,
    private options: {
      maxWorkers: number
      origin: string
    },
  ) {
    this._traces = project.vitest._traces
    this._otel = this._traces.startContextSpan('vitest.browser')
    this._otel.span.setAttributes({
      'vitest.project': project.name,
      'vitest.browser.provider': this.project.browser!.provider.name,
    })
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

    // open the minimum amount of tabs
    // if there is only 1 file running, we don't need 8 tabs running
    const workerCount = Math.min(
      this.options.maxWorkers - this.orchestrators.size,
      files.length,
    )

    const promises: Promise<void>[] = []
    for (let i = 0; i < workerCount; i++) {
      const sessionId = crypto.randomUUID()
      this.project.vitest._browserSessions.sessionIds.add(sessionId)
      const project = this.project.name
      debug?.('[%s] creating session for %s', sessionId, project)
      let page = this._traces.$(
        `vitest.browser.open`,
        {
          context: this._otel.context,
          attributes: {
            'vitest.browser.session_id': sessionId,
          },
        },
        () => this.openPage(sessionId, { parallel: workerCount > 1 }),
      )
      page = page.then(() => {
        // start running tests on the page when it's ready
        this.runNextTest(method, sessionId)
      })
      promises.push(page)
    }
    await Promise.all(promises)
    debug?.('all sessions are created')
    return this._promise
  }

  private async openPage(sessionId: string, options: { parallel: boolean }): Promise<void> {
    const sessionPromise = this.project.vitest._browserSessions.createSession(
      sessionId,
      this.project,
      this,
    )
    const browser = this.project.browser!
    const url = new URL('/__vitest_test__/', this.options.origin)
    url.searchParams.set('sessionId', sessionId)
    const otelCarrier = this._traces.getContextCarrier()
    if (otelCarrier) {
      url.searchParams.set('otelCarrier', JSON.stringify(otelCarrier))
    }
    const pagePromise = browser.provider.openPage(
      sessionId,
      url.toString(),
      options,
    )
    await Promise.all([sessionPromise, pagePromise])
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

    // the last worker finished running tests
    if (this.readySessions.size === this.orchestrators.size) {
      this._otel.span.end()
      this._promise?.resolve()
      this._promise = undefined
      debug?.('[%s] all tests finished running', sessionId)
    }
    else {
      debug?.(
        `did not finish sessions for ${sessionId}: |ready - %s| |overall - %s|`,
        [...this.readySessions].join(', '),
        [...this.orchestrators.keys()].join(', '),
      )
    }
  }

  private runNextTest(method: 'run' | 'collect', sessionId: string): void {
    const file = this._queue.shift()

    if (!file) {
      debug?.('[%s] no more tests to run', sessionId)
      const isolate = this.project.config.browser.isolate
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

    this.setBreakpoint(sessionId, file.filepath).then(() => {
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
          return orchestrator.createTesters(
            {
              method,
              files: [file],
              // this will be parsed by the test iframe, not the orchestrator
              // so we need to stringify it first to avoid double serialization
              providedContext: this._providedContext || '[{}]',
              otelCarrier: this._traces.getContextCarrier(),
            },
          )
        },
      )
      testersPromise
        .then(() => {
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
