import type { CancelReason, File } from '@vitest/runner'
import type { Awaitable } from '@vitest/utils'
import type { Writable } from 'node:stream'
import type { ViteDevServer } from 'vite'
import type { defineWorkspace } from 'vitest/config'
import type { SerializedCoverageConfig } from '../runtime/config'
import type { ArgumentsType, ProvidedContext, UserConsoleLog } from '../types/general'
import type { ProcessPool, WorkspaceSpec } from './pool'
import type { TestSpecification } from './spec'
import type { ResolvedConfig, UserConfig, VitestRunMode } from './types/config'
import type { CoverageProvider } from './types/coverage'
import type { Reporter } from './types/reporter'
import type { TestRunResult } from './types/tests'
import { promises as fs } from 'node:fs'
import { getTasks, hasFailed } from '@vitest/runner/utils'
import { SnapshotManager } from '@vitest/snapshot/manager'
import { noop, toArray } from '@vitest/utils'
import { dirname, join, normalize, relative } from 'pathe'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { version } from '../../package.json' with { type: 'json' }
import { WebSocketReporter } from '../api/setup'
import { defaultBrowserPort, workspacesFiles as workspaceFiles } from '../constants'
import { getCoverageProvider } from '../integrations/coverage'
import { distDir } from '../paths'
import { wildcardPatternToRegExp } from '../utils/base'
import { convertTasksToEvents } from '../utils/tasks'
import { BrowserSessions } from './browser/sessions'
import { VitestCache } from './cache'
import { resolveConfig } from './config/resolveConfig'
import { FilesNotFoundError } from './errors'
import { Logger } from './logger'
import { VitestPackageInstaller } from './packageInstaller'
import { createPool } from './pool'
import { TestProject } from './project'
import { BlobReporter, readBlobs } from './reporters/blob'
import { HangingProcessReporter } from './reporters/hanging-process'
import { createBenchmarkReporters, createReporters } from './reporters/utils'
import { VitestSpecifications } from './specifications'
import { StateManager } from './state'
import { TestRun } from './test-run'
import { VitestWatcher } from './watcher'
import { resolveBrowserWorkspace, resolveWorkspace } from './workspace/resolveWorkspace'

const WATCHER_DEBOUNCE = 100

export interface VitestOptions {
  packageInstaller?: VitestPackageInstaller
  stdin?: NodeJS.ReadStream
  stdout?: NodeJS.WriteStream | Writable
  stderr?: NodeJS.WriteStream | Writable
}

export class Vitest {
  /**
   * Current Vitest version.
   * @example '2.0.0'
   */
  public readonly version = version
  static readonly version = version
  /**
   * The logger instance used to log messages. It's recommended to use this logger instead of `console`.
   * It's possible to override stdout and stderr streams when initiating Vitest.
   * @example
   * new Vitest('test', {
   *   stdout: new Writable(),
   * })
   */
  public readonly logger: Logger
  /**
   * The package installer instance used to install Vitest packages.
   * @example
   * await vitest.packageInstaller.ensureInstalled('@vitest/browser', process.cwd())
   */
  public readonly packageInstaller: VitestPackageInstaller
  /**
   * A path to the built Vitest directory. This is usually a folder in `node_modules`.
   */
  public readonly distPath = distDir
  /**
   * A list of projects that are currently running.
   * If projects were filtered with `--project` flag, they won't appear here.
   */
  public projects: TestProject[] = []

  /** @internal */ configOverride: Partial<ResolvedConfig> = {}
  /** @internal */ coverageProvider: CoverageProvider | null | undefined
  /** @internal */ filenamePattern?: string[]
  /** @internal */ runningPromise?: Promise<TestRunResult>
  /** @internal */ closingPromise?: Promise<void>
  /** @internal */ isCancelling = false
  /** @internal */ coreWorkspaceProject: TestProject | undefined
  /** @internal */ resolvedProjects: TestProject[] = []
  /** @internal */ _browserLastPort = defaultBrowserPort
  /** @internal */ _browserSessions = new BrowserSessions()
  /** @internal */ _options: UserConfig = {}
  /** @internal */ reporters: Reporter[] = undefined!
  /** @internal */ vitenode: ViteNodeServer = undefined!
  /** @internal */ runner: ViteNodeRunner = undefined!
  /** @internal */ _testRun: TestRun = undefined!

  private isFirstRun = true
  private restartsCount = 0

  private readonly specifications: VitestSpecifications
  private readonly watcher: VitestWatcher
  private pool: ProcessPool | undefined
  private _config?: ResolvedConfig
  private _vite?: ViteDevServer
  private _state?: StateManager
  private _cache?: VitestCache
  private _snapshot?: SnapshotManager
  private _workspaceConfigPath?: string

  constructor(
    public readonly mode: VitestRunMode,
    options: VitestOptions = {},
  ) {
    this.logger = new Logger(this, options.stdout, options.stderr)
    this.packageInstaller = options.packageInstaller || new VitestPackageInstaller()
    this.specifications = new VitestSpecifications(this)
    this.watcher = new VitestWatcher(this).onWatcherRerun(file =>
      this.scheduleRerun([file]), // TODO: error handling
    )
  }

  private _onRestartListeners: OnServerRestartHandler[] = []
  private _onClose: (() => Awaitable<void>)[] = []
  private _onSetServer: OnServerRestartHandler[] = []
  private _onCancelListeners: ((reason: CancelReason) => Awaitable<void>)[] = []
  private _onUserTestsRerun: OnTestsRerunHandler[] = []
  private _onFilterWatchedSpecification: ((spec: TestSpecification) => boolean)[] = []

  /** @deprecated will be removed in 4.0, use `onFilterWatchedSpecification` instead */
  public get invalidates() {
    return this.watcher.invalidates
  }

  /** @deprecated will be removed in 4.0, use `onFilterWatchedSpecification` instead */
  public get changedTests() {
    return this.watcher.changedTests
  }

  /**
   * The global config.
   */
  get config(): ResolvedConfig {
    assert(this._config, 'config')
    return this._config
  }

  /** @deprecated use `vitest.vite` instead */
  get server(): ViteDevServer {
    return this._vite!
  }

  /**
   * Global Vite's dev server instance.
   */
  get vite(): ViteDevServer {
    assert(this._vite, 'vite', 'server')
    return this._vite
  }

  /**
   * The global test state manager.
   * @experimental The State API is experimental and not subject to semver.
   */
  get state(): StateManager {
    assert(this._state, 'state')
    return this._state
  }

  /**
   * The global snapshot manager. You can access the current state on `snapshot.summary`.
   */
  get snapshot(): SnapshotManager {
    assert(this._snapshot, 'snapshot', 'snapshot manager')
    return this._snapshot
  }

  /**
   * Test results and test file stats cache. Primarily used by the sequencer to sort tests.
   */
  get cache(): VitestCache {
    assert(this._cache, 'cache')
    return this._cache
  }

  /** @deprecated internal */
  setServer(options: UserConfig, server: ViteDevServer, cliOptions: UserConfig) {
    return this._setServer(options, server, cliOptions)
  }

  /** @internal */
  async _setServer(options: UserConfig, server: ViteDevServer, cliOptions: UserConfig) {
    this._options = options
    this.watcher.unregisterWatcher()
    clearTimeout(this._rerunTimer)
    this.restartsCount += 1
    this._browserLastPort = defaultBrowserPort
    this.pool?.close?.()
    this.pool = undefined
    this.closingPromise = undefined
    this.projects = []
    this.resolvedProjects = []
    this._workspaceConfigPath = undefined
    this.coverageProvider = undefined
    this.runningPromise = undefined
    this.coreWorkspaceProject = undefined
    this.specifications.clearCache()
    this._onUserTestsRerun = []

    const resolved = resolveConfig(this.mode, options, server.config, this.logger)

    this._vite = server
    this._config = resolved
    this._state = new StateManager()
    this._cache = new VitestCache(this.version)
    this._snapshot = new SnapshotManager({ ...resolved.snapshotOptions })
    this._testRun = new TestRun(this)

    if (this.config.watch) {
      this.watcher.registerWatcher()
    }

    this.vitenode = new ViteNodeServer(server, this.config.server)

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
        this.report('onServerRestart')
        await this.close()
        await serverRestart(...args)
      }

      // since we set `server.hmr: false`, Vite does not auto restart itself
      server.watcher.on('change', async (file) => {
        file = normalize(file)
        const isConfig = file === server.config.configFile
          || this.resolvedProjects.some(p => p.vite.config.configFile === file)
          || file === this._workspaceConfigPath
        if (isConfig) {
          await Promise.all(this._onRestartListeners.map(fn => fn('config')))
          this.report('onServerRestart', 'config')
          await this.close()
          await serverRestart()
        }
      })
    }

    this.cache.results.setConfig(resolved.root, resolved.cache)
    try {
      await this.cache.results.readFromCache()
    }
    catch { }

    const projects = await this.resolveWorkspace(cliOptions)
    this.resolvedProjects = projects
    this.projects = projects
    const filters = toArray(resolved.project).map(s => wildcardPatternToRegExp(s))
    if (filters.length > 0) {
      this.projects = this.projects.filter(p =>
        filters.some(pattern => pattern.test(p.name)),
      )
      if (!this.projects.length) {
        throw new Error(`No projects matched the filter "${toArray(resolved.project).join('", "')}".`)
      }
    }
    if (!this.coreWorkspaceProject) {
      this.coreWorkspaceProject = TestProject._createBasicProject(this)
    }

    if (this.config.testNamePattern) {
      this.configOverride.testNamePattern = this.config.testNamePattern
    }

    this.reporters = resolved.mode === 'benchmark'
      ? await createBenchmarkReporters(toArray(resolved.benchmark?.reporters), this.runner)
      : await createReporters(resolved.reporters, this)

    await Promise.all(this._onSetServer.map(fn => fn()))
  }

  /**
   * Provide a value to the test context. This value will be available to all tests with `inject`.
   */
  public provide = <T extends keyof ProvidedContext & string>(key: T, value: ProvidedContext[T]) => {
    this.getRootProject().provide(key, value)
  }

  /**
   * Get global provided context.
   */
  public getProvidedContext(): ProvidedContext {
    return this.getRootProject().getProvidedContext()
  }

  /** @internal */
  _ensureRootProject(): TestProject {
    if (this.coreWorkspaceProject) {
      return this.coreWorkspaceProject
    }
    this.coreWorkspaceProject = TestProject._createBasicProject(this)
    return this.coreWorkspaceProject
  }

  /** @deprecated use `getRootProject` instead */
  public getCoreWorkspaceProject(): TestProject {
    return this.getRootProject()
  }

  /**
   * Return project that has the root (or "global") config.
   */
  public getRootProject(): TestProject {
    if (!this.coreWorkspaceProject) {
      throw new Error(`Root project is not initialized. This means that the Vite server was not established yet and the the workspace config is not resolved.`)
    }
    return this.coreWorkspaceProject
  }

  /**
   * @deprecated use Reported Task API instead
   */
  public getProjectByTaskId(taskId: string): TestProject {
    const task = this.state.idMap.get(taskId)
    const projectName = (task as File).projectName || task?.file?.projectName || ''
    return this.getProjectByName(projectName)
  }

  public getProjectByName(name: string): TestProject {
    const project = this.projects.find(p => p.name === name)
      || this.coreWorkspaceProject
      || this.projects[0]
    if (!project) {
      throw new Error(`Project "${name}" was not found.`)
    }
    return project
  }

  /**
   * Import a file using Vite module runner. The file will be transformed by Vite and executed in a separate context.
   * @param moduleId The ID of the module in Vite module graph
   */
  public import<T>(moduleId: string): Promise<T> {
    return this.runner.executeId(moduleId)
  }

  private async resolveWorkspaceConfigPath(): Promise<string | undefined> {
    if (typeof this.config.workspace === 'string') {
      return this.config.workspace
    }

    const configDir = this.vite.config.configFile
      ? dirname(this.vite.config.configFile)
      : this.config.root

    const rootFiles = await fs.readdir(configDir)

    const workspaceConfigName = workspaceFiles.find((configFile) => {
      return rootFiles.includes(configFile)
    })

    if (!workspaceConfigName) {
      return undefined
    }

    return join(configDir, workspaceConfigName)
  }

  private async resolveWorkspace(cliOptions: UserConfig): Promise<TestProject[]> {
    if (Array.isArray(this.config.workspace)) {
      return resolveWorkspace(
        this,
        cliOptions,
        undefined,
        this.config.workspace,
      )
    }

    const workspaceConfigPath = await this.resolveWorkspaceConfigPath()

    this._workspaceConfigPath = workspaceConfigPath

    if (!workspaceConfigPath) {
      return resolveBrowserWorkspace(this, new Set(), [this._ensureRootProject()])
    }

    const workspaceModule = await this.import<{
      default: ReturnType<typeof defineWorkspace>
    }>(workspaceConfigPath)

    if (!workspaceModule.default || !Array.isArray(workspaceModule.default)) {
      throw new TypeError(`Workspace config file "${workspaceConfigPath}" must export a default array of project paths.`)
    }

    return resolveWorkspace(
      this,
      cliOptions,
      workspaceConfigPath,
      workspaceModule.default,
    )
  }

  /**
   * Glob test files in every project and create a TestSpecification for each file and pool.
   * @param filters String filters to match the test files.
   */
  public async globTestSpecifications(filters: string[] = []): Promise<TestSpecification[]> {
    return this.specifications.globTestSpecifications(filters)
  }

  private async initCoverageProvider(): Promise<CoverageProvider | null | undefined> {
    if (this.coverageProvider !== undefined) {
      return
    }
    this.coverageProvider = await getCoverageProvider(
      this.config.coverage as unknown as SerializedCoverageConfig,
      this.runner,
    )
    if (this.coverageProvider) {
      await this.coverageProvider.initialize(this)
      this.config.coverage = this.coverageProvider.resolveOptions()
    }
    return this.coverageProvider
  }

  /**
   * Merge reports from multiple runs located in the specified directory (value from `--merge-reports` if not specified).
   */
  public async mergeReports(directory?: string): Promise<TestRunResult> {
    if (this.reporters.some(r => r instanceof BlobReporter)) {
      throw new Error('Cannot merge reports when `--reporter=blob` is used. Remove blob reporter from the config first.')
    }

    const { files, errors, coverages } = await readBlobs(this.version, directory || this.config.mergeReports, this.projects)

    await this.report('onInit', this)
    await this.report('onPathsCollected', files.flatMap(f => f.filepath))

    const specifications: TestSpecification[] = []
    for (const file of files) {
      const project = this.getProjectByName(file.projectName || '')
      const specification = project.createSpecification(file.filepath, undefined, file.pool)
      specifications.push(specification)
    }

    await this.report('onSpecsCollected', specifications.map(spec => spec.toJSON()))
    await this._testRun.start(specifications).catch(noop)

    for (const file of files) {
      const project = this.getProjectByName(file.projectName || '')
      await this._testRun.enqueued(project, file).catch(noop)
      await this._testRun.collected(project, [file]).catch(noop)

      const logs: UserConsoleLog[] = []

      const { packs, events } = convertTasksToEvents(file, (task) => {
        if (task.logs) {
          logs.push(...task.logs)
        }
      })

      logs.sort((log1, log2) => log1.time - log2.time)

      for (const log of logs) {
        await this._testRun.log(log).catch(noop)
      }

      await this._testRun.updated(packs, events).catch(noop)
    }

    if (hasFailed(files)) {
      process.exitCode = 1
    }

    this._checkUnhandledErrors(errors)
    await this._testRun.end(specifications, errors).catch(noop)
    await this.initCoverageProvider()
    await this.coverageProvider?.mergeReports?.(coverages)

    return {
      testModules: this.state.getTestModules(),
      unhandledErrors: this.state.getUnhandledErrors(),
    }
  }

  async collect(filters?: string[]): Promise<TestRunResult> {
    this._onClose = []

    const files = await this.specifications.getRelevantTestSpecifications(filters)

    // if run with --changed, don't exit if no tests are found
    if (!files.length) {
      return { testModules: [], unhandledErrors: [] }
    }

    return this.collectTests(files)
  }

  /** @deprecated use `getRelevantTestSpecifications` instead */
  public listFiles(filters?: string[]): Promise<TestSpecification[]> {
    return this.getRelevantTestSpecifications(filters)
  }

  /**
   * Returns the list of test files that match the config and filters.
   * @param filters String filters to match the test files
   */
  getRelevantTestSpecifications(filters?: string[]): Promise<TestSpecification[]> {
    return this.specifications.getRelevantTestSpecifications(filters)
  }

  /**
   * Initialize reporters, the coverage provider, and run tests.
   * This method can throw an error:
   *   - `FilesNotFoundError` if no tests are found
   *   - `GitNotFoundError` if `--related` flag is used, but git repository is not initialized
   *   - `Error` from the user reporters
   * @param filters String filters to match the test files
   */
  async start(filters?: string[]): Promise<TestRunResult> {
    this._onClose = []

    try {
      await this.initCoverageProvider()
      await this.coverageProvider?.clean(this.config.coverage.clean)
    }
    finally {
      await this.report('onInit', this)
    }

    this.filenamePattern = filters && filters?.length > 0 ? filters : undefined
    const files = await this.specifications.getRelevantTestSpecifications(filters)

    // if run with --changed, don't exit if no tests are found
    if (!files.length) {
      const throwAnError = !this.config.watch || !(this.config.changed || this.config.related?.length)

      await this._testRun.start([])
      const coverage = await this.coverageProvider?.generateCoverage?.({ allTestsRun: true })

      // set exit code before calling `onTestRunEnd` so the lifecycle is consistent
      if (throwAnError) {
        const exitCode = this.config.passWithNoTests ? 0 : 1
        process.exitCode = exitCode
      }

      await this._testRun.end([], [], coverage)
      // Report coverage for uncovered files
      await this.reportCoverage(coverage, true)

      if (throwAnError) {
        throw new FilesNotFoundError(this.mode)
      }
    }

    let testModules: TestRunResult = {
      testModules: [],
      unhandledErrors: [],
    }

    if (files.length) {
      // populate once, update cache on watch
      await this.cache.stats.populateStats(this.config.root, files)

      testModules = await this.runFiles(files, true)
    }

    if (this.config.watch) {
      await this.report('onWatcherStart')
    }

    return testModules
  }

  /**
   * Initialize reporters and the coverage provider. This method doesn't run any tests.
   * If the `--watch` flag is provided, Vitest will still run changed tests even if this method was not called.
   */
  async init(): Promise<void> {
    this._onClose = []

    try {
      await this.initCoverageProvider()
      await this.coverageProvider?.clean(this.config.coverage.clean)
    }
    finally {
      await this.report('onInit', this)
    }

    // populate test files cache so watch mode can trigger a file rerun
    await this.globTestSpecifications()

    if (this.config.watch) {
      await this.report('onWatcherStart')
    }
  }

  /**
   * @deprecated remove when vscode extension supports "getModuleSpecifications"
   */
  getProjectsByTestFile(file: string): WorkspaceSpec[] {
    return this.getModuleSpecifications(file) as WorkspaceSpec[]
  }

  /** @deprecated */
  getFileWorkspaceSpecs(file: string): WorkspaceSpec[] {
    return this.getModuleSpecifications(file) as WorkspaceSpec[]
  }

  /**
   * Get test specifications associated with the given module. If module is not a test file, an empty array is returned.
   *
   * **Note:** this method relies on a cache generated by `globTestSpecifications`. If the file was not processed yet, use `project.matchesGlobPattern` instead.
   * @param moduleId The module ID to get test specifications for.
   */
  public getModuleSpecifications(moduleId: string): TestSpecification[] {
    return this.specifications.getModuleSpecifications(moduleId)
  }

  /**
   * Vitest automatically caches test specifications for each file. This method clears the cache for the given file or the whole cache altogether.
   */
  public clearSpecificationsCache(moduleId?: string) {
    this.specifications.clearCache(moduleId)
  }

  /**
   * Run tests for the given test specifications. This does not trigger `onWatcher*` events.
   * @param specifications A list of specifications to run.
   * @param allTestsRun Indicates whether all tests were run. This only matters for coverage.
   */
  public runTestSpecifications(specifications: TestSpecification[], allTestsRun = false): Promise<TestRunResult> {
    specifications.forEach(spec => this.specifications.ensureSpecificationCached(spec))
    return this.runFiles(specifications, allTestsRun)
  }

  /**
   * Rerun files and trigger `onWatcherRerun`, `onWatcherStart` and `onTestsRerun` events.
   * @param specifications A list of specifications to run.
   * @param allTestsRun Indicates whether all tests were run. This only matters for coverage.
   */
  public async rerunTestSpecifications(specifications: TestSpecification[], allTestsRun = false): Promise<TestRunResult> {
    this.configOverride.testNamePattern = undefined
    const files = specifications.map(spec => spec.moduleId)
    await Promise.all([
      this.report('onWatcherRerun', files, 'rerun test'),
      ...this._onUserTestsRerun.map(fn => fn(specifications)),
    ])
    const result = await this.runTestSpecifications(specifications, allTestsRun)

    await this.report('onWatcherStart', this.state.getFiles(files))
    return result
  }

  private async runFiles(specs: TestSpecification[], allTestsRun: boolean): Promise<TestRunResult> {
    await this._testRun.start(specs)

    // previous run
    await this.runningPromise
    this._onCancelListeners = []
    this.isCancelling = false

    // schedule the new run
    this.runningPromise = (async () => {
      try {
        if (!this.pool) {
          this.pool = createPool(this)
        }

        const invalidates = Array.from(this.watcher.invalidates)
        this.watcher.invalidates.clear()
        this.snapshot.clear()
        this.state.clearErrors()

        if (!this.isFirstRun && this.config.coverage.cleanOnRerun) {
          await this.coverageProvider?.clean()
        }

        await this.initializeGlobalSetup(specs)

        try {
          await this.pool.runTests(specs, invalidates)
        }
        catch (err) {
          this.state.catchError(err, 'Unhandled Error')
        }

        const files = this.state.getFiles()

        if (hasFailed(files)) {
          process.exitCode = 1
        }

        this.cache.results.updateResults(files)
        await this.cache.results.writeToCache()

        return {
          testModules: this.state.getTestModules(),
          unhandledErrors: this.state.getUnhandledErrors(),
        }
      }
      finally {
        // TODO: wait for coverage only if `onFinished` is defined
        const coverage = await this.coverageProvider?.generateCoverage({ allTestsRun })

        const errors = this.state.getUnhandledErrors()
        this._checkUnhandledErrors(errors)
        await this._testRun.end(specs, errors, coverage)
        await this.reportCoverage(coverage, allTestsRun)
      }
    })()
      .finally(() => {
        this.runningPromise = undefined
        this.isFirstRun = false

        // all subsequent runs will treat this as a fresh run
        this.config.changed = false
        this.config.related = undefined
      })

    return await this.runningPromise
  }

  /**
   * Collect tests in specified modules. Vitest will run the files to collect tests.
   * @param specifications A list of specifications to run.
   */
  public async collectTests(specifications: TestSpecification[]): Promise<TestRunResult> {
    const filepaths = specifications.map(spec => spec.moduleId)
    this.state.collectPaths(filepaths)

    // previous run
    await this.runningPromise
    this._onCancelListeners = []
    this.isCancelling = false

    // schedule the new run
    this.runningPromise = (async () => {
      if (!this.pool) {
        this.pool = createPool(this)
      }

      const invalidates = Array.from(this.watcher.invalidates)
      this.watcher.invalidates.clear()
      this.snapshot.clear()
      this.state.clearErrors()

      await this.initializeGlobalSetup(specifications)

      try {
        await this.pool.collectTests(specifications, invalidates)
      }
      catch (err) {
        this.state.catchError(err, 'Unhandled Error')
      }

      const files = this.state.getFiles()

      // can only happen if there was a syntax error in describe block
      // or there was an error importing a file
      if (hasFailed(files)) {
        process.exitCode = 1
      }

      return {
        testModules: this.state.getTestModules(),
        unhandledErrors: this.state.getUnhandledErrors(),
      }
    })()
      .finally(() => {
        this.runningPromise = undefined

        // all subsequent runs will treat this as a fresh run
        this.config.changed = false
        this.config.related = undefined
      })

    return await this.runningPromise
  }

  /**
   * Gracefully cancel the current test run. Vitest will wait until all running tests are finished before cancelling.
   */
  async cancelCurrentRun(reason: CancelReason): Promise<void> {
    this.isCancelling = true
    await Promise.all(this._onCancelListeners.splice(0).map(listener => listener(reason)))
    await this.runningPromise
  }

  /** @internal */
  async _initBrowserServers(): Promise<void> {
    await Promise.all(this.projects.map(p => p._initBrowserServer()))
  }

  private async initializeGlobalSetup(paths: TestSpecification[]): Promise<void> {
    const projects = new Set(paths.map(spec => spec.project))
    const coreProject = this.getRootProject()
    if (!projects.has(coreProject)) {
      projects.add(coreProject)
    }
    for (const project of projects) {
      await project._initializeGlobalSetup()
    }
  }

  /** @internal */
  async rerunFiles(files: string[] = this.state.getFilepaths(), trigger?: string, allTestsRun = true, resetTestNamePattern = false): Promise<TestRunResult> {
    if (resetTestNamePattern) {
      this.configOverride.testNamePattern = undefined
    }

    if (this.filenamePattern) {
      const filteredFiles = await this.globTestSpecifications(this.filenamePattern)
      files = files.filter(file => filteredFiles.some(f => f.moduleId === file))
    }

    const specifications = files.flatMap(file => this.getModuleSpecifications(file))
    const specificationsWithFilterByProject = this.configOverride.project ? specifications.filter(spec => spec.project.name === this.configOverride.project) : specifications
    await Promise.all([
      this.report('onWatcherRerun', files, trigger),
      ...this._onUserTestsRerun.map(fn => fn(specificationsWithFilterByProject)),
    ])
    const testResult = await this.runFiles(specificationsWithFilterByProject, allTestsRun)

    await this.report('onWatcherStart', this.state.getFiles(files))
    return testResult
  }

  /** @internal */
  async rerunTask(id: string): Promise<void> {
    const task = this.state.idMap.get(id)
    if (!task) {
      throw new Error(`Task ${id} was not found`)
    }
    await this.changeNamePattern(
      task.name,
      [task.file.filepath],
      'tasks' in task ? 'rerun suite' : 'rerun test',
    )
  }

  /** @internal */
  async changeProjectName(pattern: string): Promise<void> {
    if (pattern === '') {
      delete this.configOverride.project
    }
    else {
      this.configOverride.project = pattern
    }

    this.projects = this.resolvedProjects.filter(p => p.name === pattern)
    const files = (await this.globTestSpecifications()).map(spec => spec.moduleId)
    await this.rerunFiles(files, 'change project filter', pattern === '')
  }

  /** @internal */
  async changeNamePattern(pattern: string, files: string[] = this.state.getFilepaths(), trigger?: string): Promise<void> {
    // Empty test name pattern should reset filename pattern as well
    if (pattern === '') {
      this.filenamePattern = undefined
    }

    const testNamePattern = pattern ? new RegExp(pattern) : undefined
    this.configOverride.testNamePattern = testNamePattern
    // filter only test files that have tests matching the pattern
    if (testNamePattern) {
      files = files.filter((filepath) => {
        const files = this.state.getFiles([filepath])
        return !files.length || files.some((file) => {
          const tasks = getTasks(file)
          return !tasks.length || tasks.some(task => testNamePattern.test(task.name))
        })
      })
    }
    await this.rerunFiles(files, trigger, pattern === '')
  }

  /** @internal */
  async changeFilenamePattern(pattern: string, files: string[] = this.state.getFilepaths()): Promise<void> {
    this.filenamePattern = pattern ? [pattern] : []

    const trigger = this.filenamePattern.length ? 'change filename pattern' : 'reset filename pattern'

    await this.rerunFiles(files, trigger, pattern === '')
  }

  /** @internal */
  async rerunFailed(): Promise<void> {
    await this.rerunFiles(this.state.getFailedFilepaths(), 'rerun failed', false)
  }

  /**
   * Update snapshots in specified files. If no files are provided, it will update files with failed tests and obsolete snapshots.
   * @param files The list of files on the file system
   */
  async updateSnapshot(files?: string[]): Promise<TestRunResult> {
    // default to failed files
    files = files || [
      ...this.state.getFailedFilepaths(),
      ...this.snapshot.summary.uncheckedKeysByFile.map(s => s.filePath),
    ]

    this.enableSnapshotUpdate()

    try {
      return await this.rerunFiles(files, 'update snapshot', false)
    }
    finally {
      this.resetSnapshotUpdate()
    }
  }

  /**
   * Enable the mode that allows updating snapshots when running tests.
   * This method doesn't run any tests.
   *
   * Every test that runs after this method is called will update snapshots.
   * To disable the mode, call `resetSnapshotUpdate`.
   */
  public enableSnapshotUpdate(): void {
    this.configOverride.snapshotOptions = {
      updateSnapshot: 'all',
      // environment is resolved inside a worker thread
      snapshotEnvironment: null as any,
    }
    this.snapshot.options.updateSnapshot = 'all'
  }

  /**
   * Disable the mode that allows updating snapshots when running tests.
   */
  public resetSnapshotUpdate(): void {
    delete this.configOverride.snapshotOptions
    this.snapshot.options.updateSnapshot = this.config.snapshotOptions.updateSnapshot
  }

  /**
   * Set the global test name pattern to a regexp.
   * This method doesn't run any tests.
   */
  public setGlobalTestNamePattern(pattern: string | RegExp): void {
    if (pattern instanceof RegExp) {
      this.configOverride.testNamePattern = pattern
    }
    else {
      this.configOverride.testNamePattern = pattern ? new RegExp(pattern) : undefined
    }
  }

  /**
   * Resets the global test name pattern. This method doesn't run any tests.
   */
  public resetGlobalTestNamePattern(): void {
    this.configOverride.testNamePattern = undefined
  }

  private _rerunTimer: any
  // we can't use a single `triggerId` yet because vscode extension relies on this
  private async scheduleRerun(triggerId: string[]): Promise<void> {
    const currentCount = this.restartsCount
    clearTimeout(this._rerunTimer)
    await this.runningPromise
    clearTimeout(this._rerunTimer)

    // server restarted
    if (this.restartsCount !== currentCount) {
      return
    }

    this._rerunTimer = setTimeout(async () => {
      if (this.watcher.changedTests.size === 0) {
        this.watcher.invalidates.clear()
        return
      }

      // server restarted
      if (this.restartsCount !== currentCount) {
        return
      }

      this.isFirstRun = false

      this.snapshot.clear()
      let files = Array.from(this.watcher.changedTests)

      if (this.filenamePattern) {
        const filteredFiles = await this.globTestSpecifications(this.filenamePattern)
        files = files.filter(file => filteredFiles.some(f => f.moduleId === file))

        // A file that does not match the current filename pattern was changed
        if (files.length === 0) {
          return
        }
      }

      this.watcher.changedTests.clear()

      const triggerIds = new Set(triggerId.map(id => relative(this.config.root, id)))
      const triggerLabel = Array.from(triggerIds).join(', ')
      // get file specifications and filter them if needed
      const specifications = files.flatMap(file => this.getModuleSpecifications(file)).filter((specification) => {
        if (this._onFilterWatchedSpecification.length === 0) {
          return true
        }
        return this._onFilterWatchedSpecification.every(fn => fn(specification))
      })
      await Promise.all([
        this.report('onWatcherRerun', files, triggerLabel),
        ...this._onUserTestsRerun.map(fn => fn(specifications)),
      ])

      await this.runFiles(specifications, false)

      await this.report('onWatcherStart', this.state.getFiles(files))
    }, WATCHER_DEBOUNCE)
  }

  /**
   * Invalidate a file in all projects.
   */
  public invalidateFile(filepath: string): void {
    this.projects.forEach(({ vite, browser }) => {
      const serverMods = vite.moduleGraph.getModulesByFile(filepath)
      serverMods?.forEach(mod => vite.moduleGraph.invalidateModule(mod))

      if (browser) {
        const browserMods = browser.vite.moduleGraph.getModulesByFile(filepath)
        browserMods?.forEach(mod => browser.vite.moduleGraph.invalidateModule(mod))
      }
    })
  }

  /** @deprecated use `invalidateFile` */
  updateLastChanged(filepath: string): void {
    this.invalidateFile(filepath)
  }

  /** @internal */
  public _checkUnhandledErrors(errors: unknown[]): void {
    if (errors.length && !this.config.dangerouslyIgnoreUnhandledErrors) {
      process.exitCode = 1
    }
  }

  private async reportCoverage(coverage: unknown, allTestsRun: boolean): Promise<void> {
    if (this.state.getCountOfFailedTests() > 0) {
      await this.coverageProvider?.onTestFailure?.()

      if (!this.config.coverage.reportOnFailure) {
        return
      }
    }

    if (this.coverageProvider) {
      await this.coverageProvider.reportCoverage(coverage, { allTestsRun })
      // notify coverage iframe reload
      for (const reporter of this.reporters) {
        if (reporter instanceof WebSocketReporter) {
          reporter.onFinishedReportCoverage()
        }
      }
    }
  }

  /**
   * Closes all projects and their associated resources.
   * This can only be called once; the closing promise is cached until the server restarts.
   */
  public async close(): Promise<void> {
    if (!this.closingPromise) {
      this.closingPromise = (async () => {
        const teardownProjects = [...this.projects]
        if (this.coreWorkspaceProject && !teardownProjects.includes(this.coreWorkspaceProject)) {
          teardownProjects.push(this.coreWorkspaceProject)
        }
        // do teardown before closing the server
        for (const project of teardownProjects.reverse()) {
          await project._teardownGlobalSetup()
        }

        const closePromises: unknown[] = this.resolvedProjects.map(w => w.close())
        // close the core workspace server only once
        // it's possible that it's not initialized at all because it's not running any tests
        if (this.coreWorkspaceProject && !this.resolvedProjects.includes(this.coreWorkspaceProject)) {
          closePromises.push(this.coreWorkspaceProject.close().then(() => this._vite = undefined as any))
        }

        if (this.pool) {
          closePromises.push((async () => {
            await this.pool?.close?.()

            this.pool = undefined
          })())
        }

        closePromises.push(...this._onClose.map(fn => fn()))

        return Promise.allSettled(closePromises).then((results) => {
          results.forEach((r) => {
            if (r.status === 'rejected') {
              this.logger.error('error during close', r.reason)
            }
          })
        })
      })()
    }
    return this.closingPromise
  }

  /**
   * Closes all projects and exit the process
   * @param force If true, the process will exit immediately after closing the projects.
   */
  public async exit(force = false): Promise<void> {
    setTimeout(() => {
      this.report('onProcessTimeout').then(() => {
        console.warn(`close timed out after ${this.config.teardownTimeout}ms`)
        this.state.getProcessTimeoutCauses().forEach(cause => console.warn(cause))

        if (!this.pool) {
          const runningServers = [this._vite, ...this.resolvedProjects.map(p => p._vite)].filter(Boolean).length

          if (runningServers === 1) {
            console.warn('Tests closed successfully but something prevents Vite server from exiting')
          }
          else if (runningServers > 1) {
            console.warn(`Tests closed successfully but something prevents ${runningServers} Vite servers from exiting`)
          }
          else {
            console.warn('Tests closed successfully but something prevents the main process from exiting')
          }

          if (!this.reporters.some(r => r instanceof HangingProcessReporter)) {
            console.warn('You can try to identify the cause by enabling "hanging-process" reporter. See https://vitest.dev/config/#reporters')
          }
        }

        process.exit()
      })
    }, this.config.teardownTimeout).unref()

    await this.close()
    if (force) {
      process.exit()
    }
  }

  /** @internal */
  async report<T extends keyof Reporter>(name: T, ...args: ArgumentsType<Reporter[T]>) {
    await Promise.all(this.reporters.map(r => r[name]?.(
      // @ts-expect-error let me go
      ...args,
    )))
  }

  /** @internal */
  public async _globTestFilepaths() {
    const specifications = await this.globTestSpecifications()
    return Array.from(new Set(specifications.map(spec => spec.moduleId)))
  }

  /**
   * @deprecated use `globTestSpecifications` instead
   */
  public async globTestSpecs(filters: string[] = []) {
    return this.globTestSpecifications(filters)
  }

  /**
   * @deprecated use `globTestSpecifications` instead
   */
  public async globTestFiles(filters: string[] = []) {
    return this.globTestSpecifications(filters)
  }

  /** @deprecated filter by `this.projects` yourself */
  public getModuleProjects(filepath: string) {
    return this.projects.filter((project) => {
      return project.getModulesByFilepath(filepath).size
      // TODO: reevaluate || project.browser?.moduleGraph.getModulesByFile(id)?.size
    })
  }

  /**
   * Should the server be kept running after the tests are done.
   */
  shouldKeepServer(): boolean {
    return !!this.config?.watch
  }

  /**
   * Register a handler that will be called when the server is restarted due to a config change.
   */
  onServerRestart(fn: OnServerRestartHandler): void {
    this._onRestartListeners.push(fn)
  }

  /**
   * Register a handler that will be called when the test run is cancelled with `vitest.cancelCurrentRun`.
   */
  onCancel(fn: (reason: CancelReason) => Awaitable<void>): void {
    this._onCancelListeners.push(fn)
  }

  /**
   * Register a handler that will be called when the server is closed.
   */
  onClose(fn: () => Awaitable<void>): void {
    this._onClose.push(fn)
  }

  /**
   * Register a handler that will be called when the tests are rerunning.
   */
  onTestsRerun(fn: OnTestsRerunHandler): void {
    this._onUserTestsRerun.push(fn)
  }

  /**
   * Register a handler that will be called when a file is changed.
   * This callback should return `true` of `false` indicating whether the test file needs to be rerun.
   * @example
   * const testsToRun = [resolve('./test.spec.ts')]
   * vitest.onFilterWatchedSpecification(specification => testsToRun.includes(specification.moduleId))
   */
  onFilterWatchedSpecification(fn: (specification: TestSpecification) => boolean): void {
    this._onFilterWatchedSpecification.push(fn)
  }

  /** @internal */
  onAfterSetServer(fn: OnServerRestartHandler): void {
    this._onSetServer.push(fn)
  }
}

function assert(condition: unknown, property: string, name: string = property): asserts condition {
  if (!condition) {
    throw new Error(`The ${name} was not set. It means that \`vitest.${property}\` was called before the Vite server was established. Either await the Vitest promise or check that it is initialized with \`vitest.ready()\` before accessing \`vitest.${property}\`.`)
  }
}

export type OnServerRestartHandler = (reason?: string) => Promise<void> | void
export type OnTestsRerunHandler = (testFiles: TestSpecification[]) => Promise<void> | void
