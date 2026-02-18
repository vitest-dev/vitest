import type { CancelReason, File } from '@vitest/runner'
import type { Awaitable } from '@vitest/utils'
import type { Writable } from 'node:stream'
import type { ViteDevServer } from 'vite'
import type { ModuleRunner } from 'vite/module-runner'
import type { SerializedCoverageConfig } from '../runtime/config'
import type { ArgumentsType, ProvidedContext, UserConsoleLog } from '../types/general'
import type { SourceModuleDiagnostic, SourceModuleLocations } from '../types/module-locations'
import type { CliOptions } from './cli/cli-api'
import type { VitestFetchFunction } from './environments/fetchModule'
import type { ProcessPool } from './pool'
import type { TestModule } from './reporters/reported-tasks'
import type { TestSpecification } from './test-specification'
import type { ResolvedConfig, TestProjectConfiguration, UserConfig, VitestRunMode } from './types/config'
import type { CoverageProvider, ResolvedCoverageOptions } from './types/coverage'
import type { Reporter } from './types/reporter'
import type { TestRunResult } from './types/tests'
import os, { tmpdir } from 'node:os'
import { getTasks, hasFailed, limitConcurrency } from '@vitest/runner/utils'
import { SnapshotManager } from '@vitest/snapshot/manager'
import { deepClone, deepMerge, nanoid, noop, toArray } from '@vitest/utils/helpers'
import { join, normalize, relative } from 'pathe'
import { isRunnableDevEnvironment } from 'vite'
import { version } from '../../package.json' with { type: 'json' }
import { distDir } from '../paths'
import { wildcardPatternToRegExp } from '../utils/base'
import { NativeModuleRunner } from '../utils/nativeModuleRunner'
import { convertTasksToEvents } from '../utils/tasks'
import { Traces } from '../utils/traces'
import { astCollectTests, createFailedFileTask } from './ast-collect'
import { BrowserSessions } from './browser/sessions'
import { VitestCache } from './cache'
import { FileSystemModuleCache } from './cache/fsModuleCache'
import { resolveConfig } from './config/resolveConfig'
import { getCoverageProvider } from './coverage'
import { createFetchModuleFunction } from './environments/fetchModule'
import { ServerModuleRunner } from './environments/serverRunner'
import { FilesNotFoundError } from './errors'
import { Logger } from './logger'
import { collectModuleDurationsDiagnostic, collectSourceModulesLocations } from './module-diagnostic'
import { VitestPackageInstaller } from './packageInstaller'
import { createPool } from './pool'
import { TestProject } from './project'
import { getDefaultTestProject, resolveBrowserProjects, resolveProjects } from './projects/resolveProjects'
import { BlobReporter, readBlobs } from './reporters/blob'
import { HangingProcessReporter } from './reporters/hanging-process'
import { createBenchmarkReporters, createReporters } from './reporters/utils'
import { VitestResolver } from './resolver'
import { VitestSpecifications } from './specifications'
import { StateManager } from './state'
import { populateProjectsTags } from './tags'
import { TestRun } from './test-run'
import { VitestWatcher } from './watcher'

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
  public readonly version: string = version
  static readonly version: string = version
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
  public readonly distPath: string = distDir
  /**
   * A list of projects that are currently running.
   * If projects were filtered with `--project` flag, they won't appear here.
   */
  public projects: TestProject[] = []
  /**
   * A watcher handler. This is not the file system watcher. The handler only
   * exposes methods to handle changed files.
   *
   * If you have your own watcher, you can use these methods to replicate
   * Vitest behaviour.
   */
  public readonly watcher: VitestWatcher

  /** @internal */ configOverride: Partial<ResolvedConfig> = {}
  /** @internal */ filenamePattern?: string[]
  /** @internal */ runningPromise?: Promise<TestRunResult>
  /** @internal */ closingPromise?: Promise<void>
  /** @internal */ cancelPromise?: Promise<void | void[]>
  /** @internal */ isCancelling = false
  /** @internal */ coreWorkspaceProject: TestProject | undefined
  /** @internal */ _browserSessions = new BrowserSessions()
  /** @internal */ _cliOptions: CliOptions = {}
  /** @internal */ reporters: Reporter[] = []
  /** @internal */ runner!: ModuleRunner
  /** @internal */ _testRun: TestRun = undefined!
  /** @internal */ _config?: ResolvedConfig
  /** @internal */ _resolver!: VitestResolver
  /** @internal */ _fetcher!: VitestFetchFunction
  /** @internal */ _fsCache!: FileSystemModuleCache
  /** @internal */ _tmpDir = join(tmpdir(), nanoid())
  /** @internal */ _traces!: Traces

  private isFirstRun = true
  private restartsCount = 0

  private readonly specifications: VitestSpecifications
  private pool: ProcessPool | undefined
  private _vite?: ViteDevServer
  private _state?: StateManager
  private _cache?: VitestCache
  private _snapshot?: SnapshotManager
  private _coverageProvider?: CoverageProvider | null | undefined

  constructor(
    public readonly mode: VitestRunMode,
    cliOptions: UserConfig,
    options: VitestOptions = {},
  ) {
    this._cliOptions = cliOptions
    this.logger = new Logger(this, options.stdout, options.stderr)
    this.packageInstaller = options.packageInstaller || new VitestPackageInstaller()
    this.specifications = new VitestSpecifications(this)
    this.watcher = new VitestWatcher(this).onWatcherRerun(file =>
      this.scheduleRerun(file), // TODO: error handling
    )
  }

  private _onRestartListeners: OnServerRestartHandler[] = []
  private _onClose: (() => Awaitable<void>)[] = []
  private _onSetServer: OnServerRestartHandler[] = []
  private _onCancelListeners = new Set<(reason: CancelReason) => Awaitable<void>>()
  private _onUserTestsRerun: OnTestsRerunHandler[] = []
  private _onFilterWatchedSpecification: ((spec: TestSpecification) => boolean)[] = []

  /**
   * The global config.
   */
  get config(): ResolvedConfig {
    assert(this._config, 'config')
    return this._config
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

  /** @internal */
  async _setServer(options: UserConfig, server: ViteDevServer) {
    this.watcher.unregisterWatcher()
    clearTimeout(this._rerunTimer)
    this.restartsCount += 1
    this.pool?.close?.()
    this.pool = undefined
    this.closingPromise = undefined
    this.projects = []
    this.runningPromise = undefined
    this.coreWorkspaceProject = undefined
    this.specifications.clearCache()
    this._coverageProvider = undefined
    this._onUserTestsRerun = []

    this._vite = server

    const resolved = resolveConfig(this, options, server.config)

    this._config = resolved
    this._state = new StateManager({
      onUnhandledError: resolved.onUnhandledError,
    })
    this._cache = new VitestCache(this.logger)
    this._snapshot = new SnapshotManager({ ...resolved.snapshotOptions })
    this._testRun = new TestRun(this)
    const otelSdkPath = resolved.experimental.openTelemetry?.sdkPath
    this._traces = new Traces({
      enabled: !!resolved.experimental.openTelemetry?.enabled,
      sdkPath: otelSdkPath,
      watchMode: resolved.watch,
    })

    if (this.config.watch) {
      this.watcher.registerWatcher()
    }

    this._resolver = new VitestResolver(server.config.cacheDir, resolved)
    this._fsCache = new FileSystemModuleCache(this)
    this._fetcher = createFetchModuleFunction(
      this._resolver,
      this._config,
      this._fsCache,
      this._traces,
      this._tmpDir,
    )
    const environment = server.environments.__vitest__
    this.runner = resolved.experimental.viteModuleRunner === false
      ? new NativeModuleRunner(resolved.root)
      : new ServerModuleRunner(
          environment,
          this._fetcher,
          resolved,
        )
    // patch default ssr runnable environment so third-party usage of `runner.import`
    // still works with Vite's external/noExternal configuration.
    const ssrEnvironment = server.environments.ssr
    if (isRunnableDevEnvironment(ssrEnvironment)) {
      const ssrRunner = new ServerModuleRunner(
        ssrEnvironment,
        this._fetcher,
        resolved,
      )
      Object.defineProperty(ssrEnvironment, 'runner', {
        value: ssrRunner,
        writable: true,
        configurable: true,
      })
    }

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
          || this.projects.some(p => p.vite.config.configFile === file)
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

    const projects = await this.resolveProjects(this._cliOptions)
    this.projects = projects

    await Promise.all(projects.flatMap((project) => {
      const hooks = project.vite.config.getSortedPluginHooks('configureVitest')
      return hooks.map(hook => hook({
        project,
        vitest: this,
        injectTestProjects: this.injectTestProject,
        /**
         * @experimental
         */
        experimental_defineCacheKeyGenerator: callback => this._fsCache.defineCacheKeyGenerator(callback),
      }))
    }))

    if (this._cliOptions.browser?.enabled) {
      const browserProjects = this.projects.filter(p => p.config.browser.enabled)
      if (!browserProjects.length) {
        throw new Error(`Vitest received --browser flag, but no project had a browser configuration.`)
      }
    }
    if (!this.projects.length) {
      const filter = toArray(resolved.project).join('", "')
      if (filter) {
        throw new Error(`No projects matched the filter "${filter}".`)
      }
      else {
        let error = `Vitest wasn't able to resolve any project.`
        if (this.config.browser.enabled && !this.config.browser.instances?.length) {
          error += ` Please, check that you specified the "browser.instances" option.`
        }
        throw new Error(error)
      }
    }

    if (!this.coreWorkspaceProject) {
      this.coreWorkspaceProject = TestProject._createBasicProject(this)
    }

    if (this.config.testNamePattern) {
      this.configOverride.testNamePattern = this.config.testNamePattern
    }

    // populate will merge all configs into every project,
    // we don't want that when just listing tags
    if (!this.config.listTags) {
      populateProjectsTags(this.coreWorkspaceProject, this.projects)
    }

    this.reporters = resolved.mode === 'benchmark'
      ? await createBenchmarkReporters(toArray(resolved.benchmark?.reporters), this.runner)
      : await createReporters(resolved.reporters, this)

    await this._fsCache.ensureCacheIntegrity()

    await Promise.all([
      ...this._onSetServer.map(fn => fn()),
      this._traces.waitInit(),
    ])
  }

  /** @internal */
  get coverageProvider(): CoverageProvider | null | undefined {
    if (this.configOverride.coverage?.enabled === false) {
      return null
    }
    return this._coverageProvider
  }

  public async listTags(): Promise<void> {
    const listTags = this.config.listTags
    if (typeof listTags === 'boolean') {
      this.logger.printTags()
    }
    else if (listTags === 'json') {
      const hasTags = [this.getRootProject(), ...this.projects].some(p => p.config.tags && p.config.tags.length > 0)
      if (!hasTags) {
        process.exitCode = 1
        this.logger.printNoTestTagsFound()
      }
      else {
        const manifest = {
          tags: this.config.tags,
          projects: this.projects.filter(p => p !== this.coreWorkspaceProject).map(p => ({
            name: p.name,
            tags: p.config.tags,
          })),
        }
        this.logger.log(JSON.stringify(manifest, null, 2))
      }
    }
    else {
      throw new Error(`Unknown value for "test.listTags": ${listTags}`)
    }
  }

  public async enableCoverage(): Promise<void> {
    this.configOverride.coverage = {} as any
    this.configOverride.coverage!.enabled = true
    await this.createCoverageProvider()
    await this.coverageProvider?.onEnabled?.()

    // onFileTransform is the only thing that affects hash
    if (this.coverageProvider?.onFileTransform) {
      this.clearAllCachePaths()
    }
  }

  public disableCoverage(): void {
    this.configOverride.coverage ??= {} as any
    this.configOverride.coverage!.enabled = false
    // onFileTransform is the only thing that affects hash
    if (this.coverageProvider?.onFileTransform) {
      this.clearAllCachePaths()
    }
  }

  private clearAllCachePaths() {
    this.projects.forEach(({ vite, browser }) => {
      const environments = [
        ...Object.values(vite.environments),
        ...Object.values(browser?.vite.environments || {}),
      ]
      environments.forEach(environment =>
        this._fsCache.invalidateAllCachePaths(environment),
      )
    })
  }

  private _coverageOverrideCache = new WeakMap<ResolvedCoverageOptions, ResolvedCoverageOptions>()

  /** @internal */
  get _coverageOptions(): ResolvedCoverageOptions {
    if (!this.configOverride.coverage) {
      return this.config.coverage
    }
    if (!this._coverageOverrideCache.has(this.configOverride.coverage)) {
      const coverage = deepClone(this.config.coverage)
      const options = deepMerge(coverage, this.configOverride.coverage)
      this._coverageOverrideCache.set(
        this.configOverride.coverage,
        options,
      )
    }
    return this._coverageOverrideCache.get(this.configOverride.coverage)!
  }

  /**
   * Inject new test projects into the workspace.
   * @param config Glob, config path or a custom config options.
   * @returns An array of new test projects. Can be empty if the name was filtered out.
   */
  private injectTestProject = async (config: TestProjectConfiguration | TestProjectConfiguration[]): Promise<TestProject[]> => {
    const currentNames = new Set(this.projects.map(p => p.name))
    const projects = await resolveProjects(
      this,
      this._cliOptions,
      undefined,
      Array.isArray(config) ? config : [config],
      currentNames,
    )
    this.projects.push(...projects)
    return projects
  }

  /**
   * Provide a value to the test context. This value will be available to all tests with `inject`.
   */
  public provide = <T extends keyof ProvidedContext & string>(key: T, value: ProvidedContext[T]): void => {
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

  /**
   * Return project that has the root (or "global") config.
   */
  public getRootProject(): TestProject {
    if (!this.coreWorkspaceProject) {
      throw new Error(`Root project is not initialized. This means that the Vite server was not established yet and the the workspace config is not resolved.`)
    }
    return this.coreWorkspaceProject
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
    return this.runner.import(moduleId)
  }

  /**
   * Creates a coverage provider if `coverage` is enabled in the config.
   */
  public async createCoverageProvider(): Promise<CoverageProvider | null> {
    if (this._coverageProvider) {
      return this._coverageProvider
    }
    const coverageProvider = await this.initCoverageProvider()
    if (coverageProvider) {
      await coverageProvider.clean(this._coverageOptions.clean)
    }
    return coverageProvider || null
  }

  private async resolveProjects(cliOptions: UserConfig): Promise<TestProject[]> {
    const names = new Set<string>()

    if (this.config.projects) {
      return resolveProjects(
        this,
        cliOptions,
        undefined,
        this.config.projects,
        names,
      )
    }

    if ('workspace' in this.config) {
      throw new Error('The `test.workspace` option was removed in Vitest 4. Please, migrate to `test.projects` instead. See https://vitest.dev/guide/projects for examples.')
    }

    // user can filter projects with --project flag, `getDefaultTestProject`
    // returns the project only if it matches the filter
    const project = getDefaultTestProject(this)
    if (!project) {
      return []
    }
    return resolveBrowserProjects(this, new Set([project.name]), [project])
  }

  /**
   * Glob test files in every project and create a TestSpecification for each file and pool.
   * @param filters String filters to match the test files.
   */
  public async globTestSpecifications(filters: string[] = []): Promise<TestSpecification[]> {
    return this.specifications.globTestSpecifications(filters)
  }

  private async initCoverageProvider(): Promise<CoverageProvider | null | undefined> {
    if (this._coverageProvider != null) {
      return
    }
    const coverageConfig = (this.configOverride.coverage
      ? this.getRootProject().serializedConfig.coverage
      : this.config.coverage) as unknown as SerializedCoverageConfig
    this._coverageProvider = await getCoverageProvider(
      coverageConfig,
      this.runner,
    )
    if (this._coverageProvider) {
      await this._coverageProvider.initialize(this)
      this.config.coverage = this._coverageProvider.resolveOptions()
    }
    return this._coverageProvider
  }

  /**
   * Deletes all Vitest caches, including `experimental.fsModuleCache`.
   * @experimental
   */
  public async experimental_clearCache(): Promise<void> {
    await this.cache.results.clearCache()
    await this._fsCache.clearCache()
  }

  /**
   * Merge reports from multiple runs located in the specified directory (value from `--merge-reports` if not specified).
   */
  public async mergeReports(directory?: string): Promise<TestRunResult> {
    return this._traces.$('vitest.merge_reports', async () => {
      if (this.reporters.some(r => r instanceof BlobReporter)) {
        throw new Error('Cannot merge reports when `--reporter=blob` is used. Remove blob reporter from the config first.')
      }

      const { files, errors, coverages, executionTimes } = await readBlobs(this.version, directory || this.config.mergeReports, this.projects)
      this.state.blobs = { files, errors, coverages, executionTimes }

      await this.report('onInit', this)

      const specifications: TestSpecification[] = []
      for (const file of files) {
        const project = this.getProjectByName(file.projectName || '')
        const specification = project.createSpecification(file.filepath, undefined, file.pool)
        specifications.push(specification)
      }

      await this._testRun.start(specifications).catch(noop)
      await this.coverageProvider?.onTestRunStart?.()

      for (const file of files) {
        await this._reportFileTask(file)
      }

      this._checkUnhandledErrors(errors)
      await this._testRun.end(specifications, errors).catch(noop)
      await this.initCoverageProvider()
      await this.coverageProvider?.mergeReports?.(coverages)

      return {
        testModules: this.state.getTestModules(),
        unhandledErrors: this.state.getUnhandledErrors(),
      }
    })
  }

  /**
   * Returns the seed, if tests are running in a random order.
   */
  public getSeed(): number | null {
    return this.config.sequence.seed ?? null
  }

  /** @internal */
  public async _reportFileTask(file: File): Promise<void> {
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

  async collect(filters?: string[], options?: { staticParse?: boolean; staticParseConcurrency?: number }): Promise<TestRunResult> {
    return this._traces.$('vitest.collect', async (collectSpan) => {
      const filenamePattern = filters && filters?.length > 0 ? filters : []
      collectSpan.setAttribute('vitest.collect.filters', filenamePattern)

      const files = await this._traces.$(
        'vitest.config.resolve_include_glob',
        async () => {
          const specifications = await this.specifications.getRelevantTestSpecifications(filters)
          collectSpan.setAttribute(
            'vitest.collect.specifications',
            specifications.map((s) => {
              const relativeModuleId = relative(s.project.config.root, s.moduleId)
              if (s.project.name) {
                return `|${s.project.name}| ${relativeModuleId}`
              }
              return relativeModuleId
            }),
          )
          return specifications
        },
      )

      // if run with --changed, don't exit if no tests are found
      if (!files.length) {
        return { testModules: [], unhandledErrors: [] }
      }

      if (options?.staticParse) {
        const testModules = await this.experimental_parseSpecifications(files, {
          concurrency: options.staticParseConcurrency,
        })
        return { testModules, unhandledErrors: [] }
      }

      return this.collectTests(files)
    })
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
    return this._traces.$('vitest.start', { context: this._traces.getContextFromEnv(process.env) }, async (startSpan) => {
      startSpan.setAttributes({
        config: this.vite.config.configFile,
      })

      try {
        await this._traces.$('vitest.coverage.init', async () => {
          await this.initCoverageProvider()
          await this.coverageProvider?.clean(this._coverageOptions.clean)
        })
      }
      finally {
        await this.report('onInit', this)
      }

      this.filenamePattern = filters && filters?.length > 0 ? filters : undefined
      startSpan.setAttribute('vitest.start.filters', this.filenamePattern || [])
      const specifications = await this._traces.$(
        'vitest.config.resolve_include_glob',
        async () => {
          const specifications = await this.specifications.getRelevantTestSpecifications(filters)
          startSpan.setAttribute(
            'vitest.start.specifications',
            specifications.map((s) => {
              const relativeModuleId = relative(s.project.config.root, s.moduleId)
              if (s.project.name) {
                return `|${s.project.name}| ${relativeModuleId}`
              }
              return relativeModuleId
            }),
          )
          return specifications
        },
      )

      // if run with --changed, don't exit if no tests are found
      if (!specifications.length) {
        await this._traces.$('vitest.test_run', async () => {
          await this._testRun.start([])
          await this.coverageProvider?.onTestRunStart?.()
          const coverage = await this.coverageProvider?.generateCoverage?.({ allTestsRun: true })

          await this._testRun.end([], [], coverage)
          // Report coverage for uncovered files
          await this.reportCoverage(coverage, true)
        })

        if (!this.config.watch || !(this.config.changed || this.config.related?.length)) {
          throw new FilesNotFoundError(this.mode)
        }
      }

      let testModules: TestRunResult = {
        testModules: [],
        unhandledErrors: [],
      }

      if (specifications.length) {
        // populate once, update cache on watch
        await this.cache.stats.populateStats(this.config.root, specifications)

        testModules = await this.runFiles(specifications, true)
      }

      if (this.config.watch) {
        await this.report('onWatcherStart')
      }

      return testModules
    })
  }

  /**
   * Initialize reporters and the coverage provider. This method doesn't run any tests.
   * If the `--watch` flag is provided, Vitest will still run changed tests even if this method was not called.
   */
  async init(): Promise<void> {
    await this._traces.$('vitest.init', async () => {
      try {
        await this.initCoverageProvider()
        await this.coverageProvider?.clean(this._coverageOptions.clean)
      }
      finally {
        await this.report('onInit', this)
      }

      // populate test files cache so watch mode can trigger a file rerun
      await this.globTestSpecifications()

      if (this.config.watch) {
        await this.report('onWatcherStart')
      }
    })
  }

  /**
   * If there is a test run happening, returns a promise that will
   * resolve when the test run is finished.
   */
  public async waitForTestRunEnd(): Promise<void> {
    if (!this.runningPromise) {
      return
    }
    await this.runningPromise
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
  public clearSpecificationsCache(moduleId?: string): void {
    this.specifications.clearCache(moduleId)
    if (!moduleId) {
      this.projects.forEach((project) => {
        project.testFilesList = null
      })
    }
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
   * Runs tests for the given file paths. This does not trigger `onWatcher*` events.
   * @param filepaths A list of file paths to run tests for.
   * @param allTestsRun Indicates whether all tests were run. This only matters for coverage.
   */
  public async runTestFiles(filepaths: string[], allTestsRun = false): Promise<TestRunResult> {
    const specifications = await this.specifications.getRelevantTestSpecifications(filepaths)
    if (!specifications.length) {
      return { testModules: [], unhandledErrors: [] }
    }
    return this.runFiles(specifications, allTestsRun)
  }

  /**
   * Rerun files and trigger `onWatcherRerun`, `onWatcherStart` and `onTestsRerun` events.
   * @param specifications A list of specifications to run.
   * @param allTestsRun Indicates whether all tests were run. This only matters for coverage.
   */
  public async rerunTestSpecifications(specifications: TestSpecification[], allTestsRun = false): Promise<TestRunResult> {
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
    return this._traces.$('vitest.test_run', async () => {
      await this._testRun.start(specs)
      await this.coverageProvider?.onTestRunStart?.()

      // previous run
      await this.cancelPromise
      await this.runningPromise
      this._onCancelListeners.clear()
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

          if (!this.isFirstRun && this._coverageOptions.cleanOnRerun) {
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

          this.cache.results.updateResults(files)
          try {
            await this.cache.results.writeToCache()
          }
          catch {}

          return {
            testModules: this.state.getTestModules(),
            unhandledErrors: this.state.getUnhandledErrors(),
          }
        }
        finally {
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
    })
  }

  /**
   * Returns module's diagnostic. If `testModule` is not provided, `selfTime` and `totalTime` will be aggregated across all tests.
   *
   * If the module was not transformed or executed, the diagnostic will be empty.
   * @experimental
   * @see {@link https://vitest.dev/api/advanced/vitest#getsourcemodulediagnostic}
   */
  public async experimental_getSourceModuleDiagnostic(moduleId: string, testModule?: TestModule): Promise<SourceModuleDiagnostic> {
    if (testModule) {
      const viteEnvironment = testModule.viteEnvironment
      // if there is no viteEnvironment, it means the file did not run yet
      if (!viteEnvironment) {
        return { modules: [], untrackedModules: [] }
      }
      const moduleLocations = await collectSourceModulesLocations(moduleId, viteEnvironment.moduleGraph)
      return collectModuleDurationsDiagnostic(moduleId, this.state, moduleLocations, testModule)
    }

    const environments = this.projects.flatMap((p) => {
      return Object.values(p.vite.environments)
    })
    const aggregatedLocationsResult = await Promise.all(
      environments.map(environment =>
        collectSourceModulesLocations(moduleId, environment.moduleGraph),
      ),
    )

    return collectModuleDurationsDiagnostic(
      moduleId,
      this.state,
      aggregatedLocationsResult.reduce<SourceModuleLocations>((acc, locations) => {
        if (locations) {
          acc.modules.push(...locations.modules)
          acc.untracked.push(...locations.untracked)
        }
        return acc
      }, { modules: [], untracked: [] }),
    )
  }

  public async experimental_parseSpecifications(specifications: TestSpecification[], options?: {
    /** @default os.availableParallelism() */
    concurrency?: number
  }): Promise<TestModule[]> {
    if (this.mode !== 'test') {
      throw new Error(`The \`experimental_parseSpecifications\` does not support "${this.mode}" mode.`)
    }
    const concurrency = options?.concurrency ?? (typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus().length)
    const limit = limitConcurrency(concurrency)
    const promises = specifications.map(specification =>
      limit(() => this.experimental_parseSpecification(specification)),
    )
    return Promise.all(promises)
  }

  public async experimental_parseSpecification(specification: TestSpecification): Promise<TestModule> {
    if (this.mode !== 'test') {
      throw new Error(`The \`experimental_parseSpecification\` does not support "${this.mode}" mode.`)
    }
    const file = await astCollectTests(specification.project, specification.moduleId).catch((error) => {
      return createFailedFileTask(specification.project, specification.moduleId, error)
    })
    // register in state, so it can be retrieved by "getReportedEntity"
    this.state.collectFiles(specification.project, [file])
    return this.state.getReportedEntity(file) as TestModule
  }

  /**
   * Collect tests in specified modules. Vitest will run the files to collect tests.
   * @param specifications A list of specifications to run.
   */
  public async collectTests(specifications: TestSpecification[]): Promise<TestRunResult> {
    const filepaths = specifications.map(spec => spec.moduleId)
    this.state.collectPaths(filepaths)

    // previous run
    await this.cancelPromise
    await this.runningPromise
    this._onCancelListeners.clear()
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
    this.cancelPromise = Promise.all([...this._onCancelListeners].map(listener => listener(reason)))

    await this.cancelPromise.finally(() => (this.cancelPromise = undefined))
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
    await Promise.all([
      this.report('onWatcherRerun', files, trigger),
      ...this._onUserTestsRerun.map(fn => fn(specifications)),
    ])
    const testResult = await this.runFiles(specifications, allTestsRun)

    await this.report('onWatcherStart', this.state.getFiles(files))
    return testResult
  }

  /** @internal */
  async rerunTask(id: string): Promise<void> {
    const task = this.state.idMap.get(id)
    if (!task) {
      throw new Error(`Task ${id} was not found`)
    }

    const reportedTask = this.state.getReportedEntityById(id)
    if (!reportedTask) {
      throw new Error(`Test specification for task ${id} was not found`)
    }

    const specifications = [reportedTask.toTestSpecification()]
    await Promise.all([
      this.report(
        'onWatcherRerun',
        [task.file.filepath],
        'tasks' in task ? 'rerun suite' : 'rerun test',
      ),
      ...this._onUserTestsRerun.map(fn => fn(specifications)),
    ])
    await this.runFiles(specifications, false)
    await this.report(
      'onWatcherStart',
      ['module' in reportedTask ? reportedTask.module.task : reportedTask.task],
    )
  }

  /** @internal */
  async changeProjectName(pattern: string): Promise<void> {
    if (pattern === '') {
      this.configOverride.project = undefined
    }
    else {
      this.configOverride.project = [pattern]
    }

    await this.vite.restart()
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
   * Returns the regexp used for the global test name pattern.
   */
  public getGlobalTestNamePattern(): RegExp | undefined {
    if (this.configOverride.testNamePattern != null) {
      return this.configOverride.testNamePattern
    }
    return this.config.testNamePattern
  }

  /**
   * Resets the global test name pattern. This method doesn't run any tests.
   */
  public resetGlobalTestNamePattern(): void {
    this.configOverride.testNamePattern = undefined
  }

  private _rerunTimer: any
  private async scheduleRerun(triggerId: string): Promise<void> {
    const currentCount = this.restartsCount
    clearTimeout(this._rerunTimer)
    await this.cancelPromise
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

      const triggerLabel = relative(this.config.root, triggerId)
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
      const environments = [
        ...Object.values(vite.environments),
        ...Object.values(browser?.vite.environments || {}),
      ]

      environments.forEach((environment) => {
        const { moduleGraph } = environment
        const modules = moduleGraph.getModulesByFile(filepath)
        if (!modules) {
          return
        }

        modules.forEach((module) => {
          moduleGraph.invalidateModule(module)
          this._fsCache.invalidateCachePath(environment, module.id!)
        })
      })
    })
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

      if (!this._coverageOptions.reportOnFailure) {
        return
      }
    }

    if (this.coverageProvider) {
      await this.coverageProvider.reportCoverage(coverage, { allTestsRun })
      // notify builtin ui and html reporter after coverage html is generated
      for (const reporter of this.reporters) {
        if (
          'onFinishedReportCoverage' in reporter
          && typeof reporter.onFinishedReportCoverage === 'function'
        ) {
          await reporter.onFinishedReportCoverage()
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
        const teardownErrors: unknown[] = []
        // do teardown before closing the server
        for (const project of teardownProjects.reverse()) {
          await project._teardownGlobalSetup().catch((error) => {
            teardownErrors.push(error)
          })
        }

        const closePromises: unknown[] = this.projects.map(w => w.close())
        // close the core workspace server only once
        // it's possible that it's not initialized at all because it's not running any tests
        if (this.coreWorkspaceProject && !this.projects.includes(this.coreWorkspaceProject)) {
          closePromises.push(this.coreWorkspaceProject.close().then(() => this._vite = undefined as any))
        }

        if (this.pool) {
          closePromises.push((async () => {
            await this.pool?.close?.()

            this.pool = undefined
          })())
        }

        closePromises.push(...this._onClose.map(fn => fn()))

        await Promise.allSettled(closePromises).then((results) => {
          [...results, ...teardownErrors.map(r => ({ status: 'rejected', reason: r }))].forEach((r) => {
            if (r.status === 'rejected') {
              this.logger.error('error during close', r.reason)
            }
          })
        })
        await this._traces?.finish()
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

        if (!this.pool) {
          const runningServers = [this._vite, ...this.projects.map(p => p._vite)].filter(Boolean).length

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
            console.warn('You can try to identify the cause by enabling "hanging-process" reporter. See https://vitest.dev/guide/reporters.html#hanging-process-reporter')
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
  onCancel(fn: (reason: CancelReason) => Awaitable<void>): () => void {
    this._onCancelListeners.add(fn)
    return () => {
      this._onCancelListeners.delete(fn)
    }
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

  /**
   * Check if the project with a given name should be included.
   */
  matchesProjectFilter(name: string): boolean {
    const projects = this._config?.project || this._cliOptions?.project
    // no filters applied, any project can be included
    if (!projects || !projects.length) {
      return true
    }
    return toArray(projects).some((project) => {
      const regexp = wildcardPatternToRegExp(project)
      return regexp.test(name)
    })
  }
}

function assert(condition: unknown, property: string, name: string = property): asserts condition {
  if (!condition) {
    throw new Error(`The ${name} was not set. It means that \`vitest.${property}\` was called before the Vite server was established. Await the Vitest promise before accessing \`vitest.${property}\`.`)
  }
}

export type OnServerRestartHandler = (reason?: string) => Promise<void> | void
export type OnTestsRerunHandler = (testFiles: TestSpecification[]) => Promise<void> | void
