import type { Context, Span } from '@opentelemetry/api'
import type { DeferPromise } from '@vitest/utils/helpers'
import type { FileSpecification } from '../../runtime/runner/types'
import type { Traces } from '../../utils/traces'
import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { TestSpecification } from '../test-specification'
import type { CDPSession } from '../types/browser'
import crypto from 'node:crypto'
import { statfsSync } from 'node:fs'
import { createDefer } from '@vitest/utils/helpers'
import { stringify } from 'flatted'
import { createDebugger } from '../../utils/debugger'
import { getSpecificationDocblock } from '../../utils/test-helpers'
import { BrowserConnectionError } from '../errors'

const debug = createDebugger('vitest:browser:pool')

const PROVIDER_CLOSE_TIMEOUT = 10_000

export interface BrowserPool {
  runTests: (
    method: 'run' | 'collect',
    specs: TestSpecification[],
    options: { maxWorkers: number },
  ) => Promise<void>
  close: () => Promise<void>
}

interface BrowserTask {
  project: TestProject
  files: FileSpecification[]
  method: 'run' | 'collect'
  // providers without a per-session mocker share a single mock registry
  // and some of them cannot drive several pages, so the instance runs alone
  exclusive: boolean
  result: DeferPromise<void>
}

export function createBrowserPool(vitest: Vitest): BrowserPool {
  // every browser instance is a worker; at most `maxWorkers` of them are open
  const workers = new Map<TestProject, BrowserWorker>()
  const activeWorkers = new Set<BrowserWorker>()
  const queue: BrowserTask[] = []
  const exitPromises: Promise<void>[] = []
  let maxWorkers = 1
  let exclusiveRunning = false

  function getThreadsCount(project: TestProject) {
    const config = project.config.browser
    if (!config.headless || !project.browser!.provider.supportsParallelism) {
      return 1
    }

    const { maxWorkers, providedOptions } = project.config
    if (providedOptions.maxWorkers) {
      return maxWorkers
    }

    // if there are more than ~12 threads (optimistically), the main thread chokes
    // https://github.com/vitest-dev/vitest/issues/7871
    return Math.min(12, maxWorkers)
  }

  // `maxWorkers` is also the budget of pages shared by the active instances:
  // every instance gets a fair share, and pages above the core count only
  // add contention and memory
  function getPageAllowance(worker: BrowserWorker): number {
    let openPages = 0
    for (const active of activeWorkers) {
      openPages += active.pageCount
    }
    const share = Math.ceil(maxWorkers / Math.max(activeWorkers.size, 1))
    const free = Math.max(0, maxWorkers - openPages)
    return Math.max(1, Math.min(worker.maxPages, share, worker.pageCount + free))
  }

  function stopWorker(worker: BrowserWorker) {
    workers.delete(worker.project)
    exitPromises.push(
      worker.stop().catch((error) => {
        vitest.logger.error(
          `Failed to close the browser for the "${worker.project.name}" project.`,
          error,
        )
      }),
    )
  }

  function evictIdleWorker(except: BrowserWorker | undefined): boolean {
    // the map keeps the least recently used worker first
    for (const worker of workers.values()) {
      if (worker !== except && !activeWorkers.has(worker)) {
        debug?.('closing the idle browser of %s to free a worker slot', worker.project.name)
        stopWorker(worker)
        return true
      }
    }
    return false
  }

  function schedule(): void {
    while (queue.length) {
      const task = queue[0]
      if (exclusiveRunning || activeWorkers.size >= maxWorkers) {
        return
      }
      if (task.exclusive && activeWorkers.size > 0) {
        return
      }

      let worker = workers.get(task.project)
      if (worker && activeWorkers.has(worker)) {
        return
      }

      const required = worker ? 0 : 1
      while (workers.size + required > maxWorkers) {
        if (!evictIdleWorker(worker)) {
          break
        }
      }

      if (!worker) {
        debug?.('creating a worker for project %s', task.project.name)
        worker = new BrowserWorker(task.project, {
          getMaxPages: getThreadsCount,
          getPageAllowance,
        })
        workers.set(task.project, worker)
      }

      queue.shift()
      activeWorkers.add(worker)
      exclusiveRunning = task.exclusive

      const current = worker
      worker
        .runTests(task.method, task.files)
        .then(
          () => task.result.resolve(),
          (error) => task.result.reject(error),
        )
        .finally(() => {
          activeWorkers.delete(current)
          exclusiveRunning = false
          workers.delete(current.project)
          workers.set(current.project, current)
          schedule()
          // the finished instance released its share of the page budget
          activeWorkers.forEach((active) => active.grow())
        })
    }
  }

  function cancel() {
    for (const task of queue.splice(0)) {
      task.result.resolve()
    }
    workers.forEach((worker) => worker.cancel())
  }

  async function runTests(
    method: 'run' | 'collect',
    specs: TestSpecification[],
    options: { maxWorkers: number },
  ): Promise<void> {
    maxWorkers = options.maxWorkers

    let isCancelled = false
    vitest.onCancel(() => {
      isCancelled = true
      cancel()
    })

    const groupedFiles = await groupSpecifications(specs)

    const tasks = await Promise.all(
      Array.from(
        groupedFiles.entries(),
        async ([project, files]): Promise<BrowserTask | undefined> => {
          await project._initBrowserProvider()

          if (!project.browser) {
            throw new TypeError(
              `The browser server was not initialized${project.name ? ` for the "${project.name}" project` : ''}. This is a bug in Vitest. Please, open a new issue with reproduction.`,
            )
          }

          if (isCancelled) {
            return
          }

          debug?.('provider is ready for %s project', project.name)

          vitest.state.clearFiles(
            project,
            files.map((f) => f.filepath),
          )

          const provider = project.browser.provider
          return {
            project,
            files,
            method,
            exclusive: !provider.mocker || !provider.supportsParallelism,
            result: createDefer<void>(),
          }
        },
      ),
    )

    if (isCancelled) {
      return
    }

    const parallelTasks: BrowserTask[] = []
    const exclusiveTasks: BrowserTask[] = []
    for (const task of tasks) {
      if (!task) {
        return
      }
      if (task.exclusive) {
        exclusiveTasks.push(task)
      } else {
        parallelTasks.push(task)
      }
    }

    // exclusive instances go last so they don't stall the parallel ones
    const ordered = [...parallelTasks, ...exclusiveTasks]
    queue.push(...ordered)
    schedule()

    await Promise.all(ordered.map((task) => task.result))
  }

  async function close() {
    for (const task of queue.splice(0)) {
      task.result.resolve()
    }
    const stopping = Array.from(workers.values(), (worker) => worker.stop())
    workers.clear()
    activeWorkers.clear()
    await Promise.all([...stopping, ...exitPromises.splice(0)])
    // pages can be opened outside of the pool (`vitest.standalone`)
    await Promise.all(vitest.projects.map((project) => closeProvider(project)))
    vitest._browserSessions.sessionIds.clear()
    vitest.projects.forEach((project) => {
      project.browser?.state.orchestrators.forEach((orchestrator) => {
        orchestrator.$close()
      })
    })
    debug?.('browser pool closed all providers')
  }

  return { runTests, close }
}

async function groupSpecifications(
  specs: TestSpecification[],
): Promise<Map<TestProject, FileSpecification[]>> {
  const groupedFiles = new Map<TestProject, FileSpecification[]>()
  // browser instances of a project share the same test files
  const code = new Map<string, Promise<string>>()
  const docblocks = await Promise.all(specs.map((spec) => getSpecificationDocblock(spec, code)))

  specs.forEach((spec, index) => {
    const { project, moduleId, testLines, testIds, testNamePattern, testTagsFilter } = spec
    const files = groupedFiles.get(project) || []
    files.push({
      filepath: moduleId,
      testLocations: testLines,
      testIds,
      testNamePattern,
      testTagsFilter,
      fileTags: docblocks[index].tags,
    })
    groupedFiles.set(project, files)
  })

  return groupedFiles
}

async function closeProvider(project: TestProject): Promise<void> {
  const browser = project.browser
  if (!browser?.provider) {
    return
  }
  debug?.('closing the browser provider of %s', project.name)
  // a frozen or crashed browser never answers the close message;
  // don't wait for it forever, the browser process is killed
  // when this process exits anyway
  let timer: ReturnType<typeof setTimeout>
  await Promise.race([
    browser.closeBrowserProvider().finally(() => clearTimeout(timer)),
    new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        project.vitest.logger.warn(
          `The browser did not close within ${PROVIDER_CLOSE_TIMEOUT}ms. The browser process will be killed when the process exits.`,
        )
        resolve()
      }, PROVIDER_CLOSE_TIMEOUT)
      timer.unref()
    }),
  ])
}

function escapePathToRegexp(path: string): string {
  return path.replace(/[/\\.?*()^${}|[\]+]/g, '\\$&')
}

class BrowserWorker {
  private _queue: FileSpecification[] = []
  private _method: 'run' | 'collect' = 'run'
  private _promise: DeferPromise<void> | undefined
  private _providedContext: string | undefined

  // every page this worker opened or adopted, busy ones are running a file
  private sessions = new Set<string>()
  private busySessions = new Set<string>()
  private openingPages = 0
  private readySessions: Set<string>
  private started = false
  private _maxPages = 1

  private _traces: Traces
  private _otel: {
    span: Span
    context: Context
  }

  constructor(
    public project: TestProject,
    private options: {
      getMaxPages: (project: TestProject) => number
      getPageAllowance: (worker: BrowserWorker) => number
    },
  ) {
    this._traces = project.vitest._traces
    this._otel = this._traces.startContextSpan('vitest.browser')
    this._otel.span.setAttributes({
      'vitest.project': project.name,
      'vitest.browser.provider': project.config.browser.provider?.name,
    })
    this.readySessions = project._browserReadySessions
  }

  public cancel(): void {
    this._queue = []
    this._otel.span.end()
  }

  public reject(error: Error): void {
    // if user cancels the test run manually, ignore the error and exit gracefully
    if (this.project.vitest.isCancelling && error instanceof BrowserConnectionError) {
      this._promise?.resolve()
    } else {
      this._promise?.reject(error)
    }
    this._promise = undefined
    this.busySessions.clear()
    this.cancel()
  }

  get orchestrators() {
    return this.project.browser!.state.orchestrators
  }

  get pageCount(): number {
    return this.sessions.size
  }

  get maxPages(): number {
    return this._maxPages
  }

  async runTests(method: 'run' | 'collect', files: FileSpecification[]): Promise<void> {
    const promise = (this._promise ??= createDefer<void>())

    if (!files.length) {
      debug?.('no tests found, finishing test run immediately')
      promise.resolve()
      return promise
    }

    this._method = method
    this._queue.push(...files)

    // the provider is closed when the pool frees the slot of an idle instance,
    // so a worker that reopens the instance starts a new one
    await this.project._initBrowserProvider()
    if (!this._queue.length) {
      debug?.('the run was cancelled while the provider was starting')
      this._promise = undefined
      promise.resolve()
      return promise
    }
    this.started = true
    this._maxPages = this.options.getMaxPages(this.project)
    this._providedContext = stringify(this.project.getProvidedContext())

    for (const sessionId of [...this.readySessions]) {
      if (!this._queue.length) {
        break
      }
      this.readySessions.delete(sessionId)
      // the page was closed while it was idle
      if (!this.orchestrators.has(sessionId)) {
        this.sessions.delete(sessionId)
        continue
      }
      this.sessions.add(sessionId)
      this.runNextTest(method, sessionId)
    }

    await this.openPages()
    debug?.('all sessions are created')
    return promise
  }

  // opens more pages when the budget allows it, e.g. after another instance finished
  grow(): void {
    if (!this.started || !this._promise || !this._queue.length) {
      return
    }
    this.openPages().catch((error) => this.reject(error))
  }

  private async openPages(): Promise<void> {
    const method = this._method
    // open the minimum amount of tabs
    // if there is only 1 file running, we don't need 8 tabs running
    const allowance = this.options.getPageAllowance(this)
    // pages that are still opening will take the next queued files
    const unassigned = this._queue.length - this.openingPages
    const count = Math.min(allowance - this.sessions.size, unassigned)
    if (count <= 0) {
      debug?.('all pages are open, not creating more')
      return
    }

    const parallel = this.sessions.size + count > 1
    const promises: Promise<void>[] = []
    for (let i = 0; i < count; i++) {
      const sessionId = crypto.randomUUID()
      this.sessions.add(sessionId)
      this.openingPages++
      const project = this.project.name
      debug?.('[%s] creating session for %s', sessionId, project)
      const page = this._traces
        .$(
          `vitest.browser.open`,
          {
            context: this._otel.context,
            attributes: {
              'vitest.browser.session_id': sessionId,
            },
          },
          () => this.openPage(sessionId, { parallel }),
        )
        .then(
          () => {
            this.openingPages--
            // start running tests on the page when it's ready
            this.runNextTest(method, sessionId)
          },
          (error) => {
            this.openingPages--
            this.sessions.delete(sessionId)
            throw error
          },
        )
      promises.push(page)
    }
    await Promise.all(promises)
  }

  async stop(): Promise<void> {
    this.cancel()
    const sessions = this.project.vitest._browserSessions
    const orchestrators = Array.from(this.sessions, (sessionId) => {
      const orchestrator = this.orchestrators.get(sessionId)
      this.orchestrators.delete(sessionId)
      sessions.destroySession(sessionId)
      return orchestrator
    })
    this.sessions.clear()
    this.busySessions.clear()
    this.readySessions.clear()
    await closeProvider(this.project)
    orchestrators.forEach((orchestrator) => orchestrator?.$close())
  }

  private async openPage(sessionId: string, options: { parallel: boolean }): Promise<void> {
    await this.project._openBrowserPage(sessionId, {
      reject: (error) => this.reject(error),
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
    for (const id of this.sessions) {
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
      throw new Error(
        `Orchestrator not found for session ${sessionId}. This is a bug in Vitest. Please, open a new issue with reproduction.`,
      )
    }
    return orchestrator
  }

  private finishSession(sessionId: string): void {
    this.busySessions.delete(sessionId)
    this.readySessions.add(sessionId)

    // the last page finished running tests
    if (!this.busySessions.size) {
      this._otel.span.end()
      this._promise?.resolve()
      this._promise = undefined
      debug?.('[%s] all tests finished running', sessionId)
    } else {
      debug?.(
        `did not finish sessions for ${sessionId}: |busy - %s| |overall - %s|`,
        [...this.busySessions].join(', '),
        [...this.sessions].join(', '),
      )
    }
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
      orchestrator
        .cleanupTesters()
        .catch((error) => this.reject(error))
        .finally(() => this.finishSession(sessionId))
      return
    }

    if (!this._promise) {
      throw new Error(`Unexpected empty queue`)
    }

    const orchestrator = this.getOrchestrator(sessionId)
    this.busySessions.add(sessionId)
    debug?.('[%s] run test %s', sessionId, file)

    // warm the transform cache while the iframe is booting so the test
    // file import doesn't wait for the transform; mirrors the URL the
    // tester will request (see `importFile` in the browser runner)
    const fileUrl = `/${/^\w:/.test(file.filepath) ? '@fs/' : ''}${file.filepath}`.replace(
      /\/+/g,
      '/',
    )
    void this.project.vite.transformRequest(fileUrl).catch(() => {})

    this.setBreakpoint(sessionId, file.filepath)
      .then(() => {
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
            return orchestrator.createTesters({
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
            })
          },
        )
        testersPromise
          .then(async () => {
            debug?.('[%s] test %s finished running', sessionId, file)
            await maybeCollectChromiumGarbage(this.project, sessionId)
            this.runNextTest(method, sessionId)
          })
          .catch((error) => {
            // if user cancels the test run manually, ignore the error and exit gracefully
            if (this.project.vitest.isCancelling && error instanceof BrowserConnectionError) {
              this.cancel()
              this._promise?.resolve()
              this._promise = undefined
              this.busySessions.clear()
              debug?.('[%s] browser connection was closed', sessionId)
              return
            }
            debug?.('[%s] error during %s test run: %s', sessionId, file, error)
            this.reject(new Error(`Failed to run the test ${file.filepath}.`, { cause: error }))
          })
      })
      .catch((err) => this.reject(err))
  }

  async setBreakpoint(sessionId: string, file: string) {
    if (!this.project.config.inspector.waitForDebugger) {
      return
    }

    const provider = this.project.browser!.provider
    const browser = this.project.config.browser.name

    if (shouldIgnoreDebugger(provider.name, browser)) {
      debug?.(
        '[$s] ignoring debugger in %s browser because it is not supported',
        sessionId,
        browser,
      )
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
// Best-effort workaround for chromium/playwright bug
// https://issues.chromium.org/issues/530892387

// Trigger gc on lower disk (default to 4GB)
const chromiumGCDiskThreshold = process.env.VITEST_CHROMIUM_GC_DISK_THRESHOLD_GB
  ? Number(process.env.VITEST_CHROMIUM_GC_DISK_THRESHOLD_GB) * 1024 ** 3
  : 4 * 1024 ** 3
const forceChromiumGC = !!process.env.VITEST_CHROMIUM_GC_FORCE
const debugGC = createDebugger('vitest:browser:gc')

async function maybeCollectChromiumGarbage(project: TestProject, sessionId: string): Promise<void> {
  // trigger only on linux/chromium/playwright
  const provider = project.browser!.provider
  if (
    (!forceChromiumGC && process.platform !== 'linux') ||
    provider.name !== 'playwright' ||
    project.config.browser.name !== 'chromium' ||
    !project.config.isolate ||
    !provider.getCDPSession
  ) {
    return
  }

  const start = performance.now()
  const diagnostics: Record<string, any> = {
    statfsBeforeMs: undefined,
    statfsAfterMs: undefined,
    cdpSessionMs: undefined,
    cdpSendMs: undefined,
    cdpDetachMs: undefined,
    forced: forceChromiumGC,
  }
  try {
    // Playwright enables --disable-dev-shm-usage by default, which makes
    // Chromium use TMPDIR or /tmp for shared memory files.
    // https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/chromium/chromiumSwitches.ts
    // https://source.chromium.org/chromium/chromium/src/+/main:base/files/file_util_posix.cc
    const tempDirectory = process.env.TMPDIR || '/tmp'
    let operationStart = performance.now()
    const fsStats = statfsSync(tempDirectory)
    diagnostics.statfsBeforeMs = performance.now() - operationStart

    const available = fsStats.bavail * fsStats.bsize
    diagnostics.availableBytesBefore = available.toString()
    diagnostics.thresholdBytes = chromiumGCDiskThreshold.toString()
    diagnostics.tempDirectory = tempDirectory
    diagnostics.triggered = available < chromiumGCDiskThreshold
    if (available >= chromiumGCDiskThreshold) {
      return
    }

    operationStart = performance.now()
    // `detach` is available only internally and not on CDPSession type
    const cdp = (await provider.getCDPSession(sessionId)) as CDPSession & {
      detach: () => Promise<void>
    }
    diagnostics.cdpSessionMs = performance.now() - operationStart

    try {
      operationStart = performance.now()
      await cdp.send('HeapProfiler.collectGarbage')
      diagnostics.cdpSendMs = performance.now() - operationStart
    } finally {
      operationStart = performance.now()
      await cdp.detach().catch((error) => {
        debugGC?.('[%s] failed to detach Chromium CDP session: %s', sessionId, error)
      })
      diagnostics.cdpDetachMs = performance.now() - operationStart
    }

    if (debugGC?.enabled) {
      operationStart = performance.now()
      const fsStatsAfter = statfsSync(tempDirectory)
      diagnostics.statfsAfterMs = performance.now() - operationStart
      diagnostics.availableBytesAfter = (fsStatsAfter.bavail * fsStatsAfter.bsize).toString()
    }

    const availableGiB = available / 1024 ** 3
    const thresholdGiB = chromiumGCDiskThreshold / 1024 ** 3
    debugGC?.(
      '[%s] Low disk space detected in %s (%s GiB available, %s GiB threshold). Vitest triggered Chromium garbage collection to prevent browser crashes.',
      sessionId,
      tempDirectory,
      availableGiB.toFixed(1),
      thresholdGiB.toFixed(1),
    )
  } catch (error) {
    // don't surface if fs or cdp fails
    debugGC?.('[%s] failed to collect Chromium garbage: %s', sessionId, error)
  } finally {
    diagnostics.totalMs = performance.now() - start
    debugGC?.('[%s] Chromium garbage collection check: %O', sessionId, diagnostics)
  }
}
