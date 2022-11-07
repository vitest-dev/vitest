import { existsSync, promises as fs } from 'fs'
import type { ViteDevServer } from 'vite'
import { normalizePath } from 'vite'
import { relative, toNamespacedPath } from 'pathe'
import fg from 'fast-glob'
import mm from 'micromatch'
import c from 'picocolors'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import type { ArgumentsType, CoverageProvider, OnServerRestartHandler, Reporter, ResolvedConfig, UserConfig, VitestRunMode } from '../types'
import { SnapshotManager } from '../integrations/snapshot/manager'
import { clearTimeout, deepMerge, hasFailed, noop, setTimeout, slash, toArray } from '../utils'
import { getCoverageProvider } from '../integrations/coverage'
import { Typechecker } from '../typecheck/typechecker'
import { createPool } from './pool'
import type { WorkerPool } from './pool'
import { createBenchmarkReporters, createReporters } from './reporters/utils'
import { StateManager } from './state'
import { resolveConfig } from './config'
import { Logger } from './logger'
import { VitestCache } from './cache'

const WATCHER_DEBOUNCE = 100

export class Vitest {
  config: ResolvedConfig = undefined!
  configOverride: Partial<ResolvedConfig> | undefined

  server: ViteDevServer = undefined!
  state: StateManager = undefined!
  snapshot: SnapshotManager = undefined!
  cache: VitestCache = undefined!
  reporters: Reporter[] = undefined!
  coverageProvider: CoverageProvider | null | undefined
  logger: Logger
  pool: WorkerPool | undefined
  typechecker: Typechecker | undefined

  vitenode: ViteNodeServer = undefined!

  invalidates: Set<string> = new Set()
  changedTests: Set<string> = new Set()
  runningPromise?: Promise<void>
  closingPromise?: Promise<void>

  isFirstRun = true
  restartsCount = 0
  runner: ViteNodeRunner = undefined!

  constructor(
    public readonly mode: VitestRunMode,
  ) {
    this.logger = new Logger(this)
  }

  private _onRestartListeners: OnServerRestartHandler[] = []

  async setServer(options: UserConfig, server: ViteDevServer) {
    this.unregisterWatcher?.()
    clearTimeout(this._rerunTimer)
    this.restartsCount += 1
    this.pool?.close()
    this.pool = undefined

    const resolved = resolveConfig(this.mode, options, server.config)

    this.server = server
    this.config = resolved
    this.state = new StateManager()
    this.cache = new VitestCache()
    this.snapshot = new SnapshotManager({ ...resolved.snapshotOptions })

    if (this.config.watch)
      this.registerWatcher()

    this.vitenode = new ViteNodeServer(server, this.config)
    const node = this.vitenode
    this.runner = new ViteNodeRunner({
      root: server.config.root,
      base: server.config.base,
      fetchModule(id: string) {
        return node.fetchModule(id)
      },
      resolveId(id: string, importer?: string) {
        return node.resolveId(id, importer)
      },
    })

    if (this.config.watch) {
      // hijack server restart
      const serverRestart = server.restart
      server.restart = async (...args) => {
        await Promise.all(this._onRestartListeners.map(fn => fn()))
        return await serverRestart(...args)
      }

      // since we set `server.hmr: false`, Vite does not auto restart itself
      server.watcher.on('change', async (file) => {
        file = normalizePath(file)
        const isConfig = file === server.config.configFile
        if (isConfig) {
          await Promise.all(this._onRestartListeners.map(fn => fn('config')))
          await serverRestart()
        }
      })
    }

    this.reporters = resolved.mode === 'benchmark'
      ? await createBenchmarkReporters(toArray(resolved.benchmark?.reporters), this.runner)
      : await createReporters(resolved.reporters, this.runner)

    this.runningPromise = undefined

    this.cache.results.setConfig(resolved.root, resolved.cache)
    try {
      await this.cache.results.readFromCache()
    }
    catch (err) {
      this.logger.error(`[vitest] Error, while trying to parse cache in ${this.cache.results.getCachePath()}:`, err)
    }
  }

  async initCoverageProvider() {
    if (this.coverageProvider !== undefined)
      return
    this.coverageProvider = await getCoverageProvider(this.config.coverage)
    if (this.coverageProvider) {
      await this.coverageProvider.initialize(this)
      this.config.coverage = this.coverageProvider.resolveOptions()
    }
    return this.coverageProvider
  }

  getSerializableConfig() {
    return deepMerge<ResolvedConfig>({
      ...this.config,
      reporters: [],
      snapshotOptions: {
        ...this.config.snapshotOptions,
        resolveSnapshotPath: undefined,
      },
      onConsoleLog: undefined!,
      sequence: {
        ...this.config.sequence,
        sequencer: undefined!,
      },
      benchmark: {
        ...this.config.benchmark,
        reporters: [],
      } as ResolvedConfig['benchmark'],
    },
    this.configOverride || {} as any,
    ) as ResolvedConfig
  }

  async typecheck(filters?: string[]) {
    const testsFilesList = await this.globTestFiles(filters)
    const checker = new Typechecker(this, testsFilesList)
    this.typechecker = checker
    checker.onParseEnd(async ({ files, sourceErrors }) => {
      await this.report('onCollected', files)
      if (!files.length)
        this.logger.printNoTestFound()
      else
        await this.report('onFinished', files)
      if (sourceErrors.length && !this.config.typecheck.ignoreSourceErrors) {
        process.exitCode = 1
        await this.logger.printSourceTypeErrors(sourceErrors)
      }
      // if there are source errors, we are showing it, and then terminating process
      if (!files.length) {
        const exitCode = this.config.passWithNoTests ? (process.exitCode ?? 0) : 1
        process.exit(exitCode)
      }
      if (this.config.watch) {
        await this.report('onWatcherStart', files, [
          ...sourceErrors,
          ...this.state.getUnhandledErrors(),
        ])
      }
    })
    checker.onParseStart(async () => {
      await this.report('onInit', this)
      await this.report('onCollected', checker.getTestFiles())
    })
    checker.onWatcherRerun(async () => {
      await this.report('onWatcherRerun', testsFilesList, 'File change detected. Triggering rerun.')
      await checker.collectTests()
      await this.report('onCollected', checker.getTestFiles())
    })
    await checker.collectTests()
    await checker.start()
  }

  async start(filters?: string[]) {
    if (this.mode === 'typecheck') {
      await this.typecheck(filters)
      return
    }

    try {
      await this.initCoverageProvider()
      await this.coverageProvider?.clean(this.config.coverage.clean)
    }
    catch (e) {
      this.logger.error(e)
      process.exit(1)
    }

    await this.report('onInit', this)

    const files = await this.filterTestsBySource(
      await this.globTestFiles(filters),
    )

    if (!files.length) {
      const exitCode = this.config.passWithNoTests ? 0 : 1

      this.logger.printNoTestFound(filters)

      process.exit(exitCode)
    }

    // populate once, update cache on watch
    await Promise.all(files.map(file => this.cache.stats.updateStats(file)))

    await this.runFiles(files)

    if (this.coverageProvider) {
      this.logger.log(c.blue(' % ') + c.dim('Coverage report from ') + c.yellow(this.coverageProvider.name))
      await this.coverageProvider.reportCoverage()
    }

    if (this.config.watch && !this.config.browser)
      await this.report('onWatcherStart')
  }

  private async getTestDependencies(filepath: string) {
    const deps = new Set<string>()

    const addImports = async (filepath: string) => {
      const transformed = await this.vitenode.transformRequest(filepath)
      if (!transformed)
        return
      const dependencies = [...transformed.deps || [], ...transformed.dynamicDeps || []]
      for (const dep of dependencies) {
        const path = await this.server.pluginContainer.resolveId(dep, filepath, { ssr: true })
        const fsPath = path && !path.external && path.id.split('?')[0]
        if (fsPath && !fsPath.includes('node_modules') && !deps.has(fsPath) && existsSync(fsPath)) {
          deps.add(fsPath)

          await addImports(fsPath)
        }
      }
    }

    await addImports(filepath)

    return deps
  }

  async filterTestsBySource(tests: string[]) {
    if (this.config.changed && !this.config.related) {
      const { VitestGit } = await import('./git')
      const vitestGit = new VitestGit(this.config.root)
      const related = await vitestGit.findChangedFiles({
        changedSince: this.config.changed,
      })
      if (!related) {
        this.logger.error(c.red('Could not find Git root. Have you initialized git with `git init`?\n'))
        process.exit(1)
      }
      this.config.related = Array.from(new Set(related))
    }

    const related = this.config.related
    if (!related)
      return tests

    const forceRerunTriggers = this.config.forceRerunTriggers
    if (forceRerunTriggers.length && mm(related, forceRerunTriggers).length)
      return tests

    // don't run anything if no related sources are found
    if (!related.length)
      return []

    const testGraphs = await Promise.all(
      tests.map(async (filepath) => {
        const deps = await this.getTestDependencies(filepath)
        return [filepath, deps] as const
      }),
    )

    const runningTests = []

    for (const [filepath, deps] of testGraphs) {
      // if deps or the test itself were changed
      if (related.some(path => path === filepath || deps.has(path)))
        runningTests.push(filepath)
    }

    return runningTests
  }

  async runFiles(paths: string[]) {
    // previous run
    await this.runningPromise
    this.state.startCollectingPaths()

    // schedule the new run
    this.runningPromise = (async () => {
      if (!this.pool)
        this.pool = createPool(this)

      const invalidates = Array.from(this.invalidates)
      this.invalidates.clear()
      this.snapshot.clear()
      this.state.clearErrors()
      try {
        await this.pool.runTests(paths, invalidates)
      }
      catch (err) {
        this.state.catchError(err, 'Unhandled Error')
      }

      const files = this.state.getFiles()

      if (hasFailed(files))
        process.exitCode = 1

      if (!this.config.browser)
        await this.report('onFinished', files, this.state.getUnhandledErrors())
      this.cache.results.updateResults(files)
      await this.cache.results.writeToCache()
    })()
      .finally(() => {
        this.runningPromise = undefined
        this.state.finishCollectingPaths()
      })

    return await this.runningPromise
  }

  async rerunFiles(files: string[] = this.state.getFilepaths(), trigger?: string) {
    await this.report('onWatcherRerun', files, trigger)
    await this.runFiles(files)
    if (!this.config.browser)
      await this.report('onWatcherStart')
  }

  async changeNamePattern(pattern: string, files: string[] = this.state.getFilepaths(), trigger?: string) {
    this.config.testNamePattern = pattern ? new RegExp(pattern) : undefined
    await this.rerunFiles(files, trigger)
  }

  async changeFilenamePattern(pattern: string) {
    const files = this.state.getFilepaths()
    if (!pattern)
      return await this.rerunFiles(files, 'reset filename pattern')
    const filteredFiles = await this.globTestFiles([pattern])
    await this.rerunFiles(filteredFiles, 'change filename pattern')
  }

  async rerunFailed() {
    await this.rerunFiles(this.state.getFailedFilepaths(), 'rerun failed')
  }

  async updateSnapshot(files?: string[]) {
    // default to failed files
    files = files || [
      ...this.state.getFailedFilepaths(),
      ...this.snapshot.summary.uncheckedKeysByFile.map(s => s.filePath),
    ]

    this.configOverride = {
      snapshotOptions: {
        updateSnapshot: 'all',
      },
    }

    try {
      await this.rerunFiles(files, 'update snapshot')
    }
    finally {
      this.configOverride = undefined
    }
  }

  private _rerunTimer: any
  private async scheduleRerun(triggerId: string) {
    const currentCount = this.restartsCount
    clearTimeout(this._rerunTimer)
    await this.runningPromise
    clearTimeout(this._rerunTimer)

    // server restarted
    if (this.restartsCount !== currentCount)
      return

    this._rerunTimer = setTimeout(async () => {
      if (this.changedTests.size === 0) {
        this.invalidates.clear()
        return
      }

      // server restarted
      if (this.restartsCount !== currentCount)
        return

      this.isFirstRun = false

      this.snapshot.clear()
      const files = Array.from(this.changedTests)
      this.changedTests.clear()

      if (this.coverageProvider && this.config.coverage.cleanOnRerun)
        await this.coverageProvider.clean()

      await this.report('onWatcherRerun', files, triggerId)

      await this.runFiles(files)

      await this.coverageProvider?.reportCoverage()

      if (!this.config.browser)
        await this.report('onWatcherStart')
    }, WATCHER_DEBOUNCE)
  }

  private unregisterWatcher = noop
  private registerWatcher() {
    const onChange = (id: string) => {
      id = slash(id)
      const needsRerun = this.handleFileChanged(id)
      if (needsRerun)
        this.scheduleRerun(id)
    }
    const onUnlink = (id: string) => {
      id = slash(id)
      this.invalidates.add(id)

      if (this.state.filesMap.has(id)) {
        this.state.filesMap.delete(id)
        this.cache.results.removeFromCache(id)
        this.cache.stats.removeStats(id)
        this.changedTests.delete(id)
        this.report('onTestRemoved', id)
      }
    }
    const onAdd = async (id: string) => {
      id = slash(id)
      if (await this.isTargetFile(id)) {
        this.changedTests.add(id)
        await this.cache.stats.updateStats(id)
        this.scheduleRerun(id)
      }
    }
    const watcher = this.server.watcher

    if (this.config.forceRerunTriggers.length)
      watcher.add(this.config.forceRerunTriggers)

    watcher.unwatch(this.config.watchExclude)

    watcher.on('change', onChange)
    watcher.on('unlink', onUnlink)
    watcher.on('add', onAdd)

    this.unregisterWatcher = () => {
      watcher.off('change', onChange)
      watcher.off('unlink', onUnlink)
      watcher.off('add', onAdd)
      this.unregisterWatcher = noop
    }
  }

  /**
   * @returns A value indicating whether rerun is needed (changedTests was mutated)
   */
  private handleFileChanged(id: string): boolean {
    if (this.changedTests.has(id) || this.invalidates.has(id))
      return false

    if (mm.isMatch(id, this.config.forceRerunTriggers)) {
      this.state.getFilepaths().forEach(file => this.changedTests.add(file))
      return true
    }

    const mod = this.server.moduleGraph.getModuleById(id)
    if (!mod)
      return false

    this.invalidates.add(id)

    if (this.state.filesMap.has(id)) {
      this.changedTests.add(id)
      return true
    }

    let rerun = false
    mod.importers.forEach((i) => {
      if (!i.id)
        return

      const heedsRerun = this.handleFileChanged(i.id)
      if (heedsRerun)
        rerun = true
    })

    return rerun
  }

  async close() {
    if (!this.closingPromise) {
      this.closingPromise = Promise.allSettled([
        this.pool?.close(),
        this.server.close(),
        this.typechecker?.stop(),
      ].filter(Boolean)).then((results) => {
        results.filter(r => r.status === 'rejected').forEach((err) => {
          this.logger.error('error during close', (err as PromiseRejectedResult).reason)
        })
      })
    }
    return this.closingPromise
  }

  /**
   * Close the thread pool and exit the process
   */
  async exit(force = false) {
    setTimeout(() => {
      console.warn(`close timed out after ${this.config.teardownTimeout}ms`)
      process.exit()
    }, this.config.teardownTimeout).unref()

    await this.close()
    if (force)
      process.exit()
  }

  async report<T extends keyof Reporter>(name: T, ...args: ArgumentsType<Reporter[T]>) {
    await Promise.all(this.reporters.map(r => r[name]?.(
      // @ts-expect-error let me go
      ...args,
    )))
  }

  async globTestFiles(filters: string[] = []) {
    const { include, exclude, includeSource } = this.config

    const globOptions = {
      absolute: true,
      cwd: this.config.dir || this.config.root,
      ignore: exclude,
    }

    let testFiles = await fg(include, globOptions)

    if (filters.length && process.platform === 'win32')
      filters = filters.map(f => toNamespacedPath(f))

    if (filters.length)
      testFiles = testFiles.filter(i => filters.some(f => i.includes(f)))

    if (includeSource) {
      let files = await fg(includeSource, globOptions)
      if (filters.length)
        files = files.filter(i => filters.some(f => i.includes(f)))

      await Promise.all(files.map(async (file) => {
        try {
          const code = await fs.readFile(file, 'utf-8')
          if (this.isInSourceTestFile(code))
            testFiles.push(file)
        }
        catch {
          return null
        }
      }))
    }

    return testFiles
  }

  async isTargetFile(id: string, source?: string): Promise<boolean> {
    const relativeId = relative(this.config.dir || this.config.root, id)
    if (mm.isMatch(relativeId, this.config.exclude))
      return false
    if (mm.isMatch(relativeId, this.config.include))
      return true
    if (this.config.includeSource?.length && mm.isMatch(relativeId, this.config.includeSource)) {
      source = source || await fs.readFile(id, 'utf-8')
      return this.isInSourceTestFile(source)
    }
    return false
  }

  isInSourceTestFile(code: string) {
    return code.includes('import.meta.vitest')
  }

  onServerRestart(fn: OnServerRestartHandler) {
    this._onRestartListeners.push(fn)
  }
}
