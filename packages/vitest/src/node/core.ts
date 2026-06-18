import type { Awaitable } from '@vitest/utils'
import type { Writable } from 'node:stream'
import type { ResolvedConfig as ResolvedViteConfig, ViteDevServer } from 'vite'
import type { ModuleRunner } from 'vite/module-runner'
import type { SerializedCoverageConfig, SerializedRootConfig } from '../runtime/config'
import type { CancelReason, File } from '../runtime/runner/types'
import type { ArgumentsType, ProvidedContext, UserConsoleLog } from '../types/general'
import type { SourceModuleDiagnostic, SourceModuleLocations } from '../types/module-locations'
import type { PluginHarness } from './config/pluginHarness'
import type { VitestFetchFunction } from './environments/fetchModule'
import type { Logger } from './logger'
import type { VitestPackageInstaller } from './packageInstaller'
import type { ProcessPool } from './pool'
import type { Report } from './reporters/report'
import type { TestModule } from './reporters/reported-tasks'
import type { TestSpecification } from './test-specification'
import type { ParentProjectBrowser } from './types/browser'
import type { ResolvedConfig, TestProjectConfiguration } from './types/config'
import type { CoverageProvider, ResolvedCoverageOptions } from './types/coverage'
import type { Reporter } from './types/reporter'
import type { TestRunResult } from './types/tests'
import type { VCSProvider } from './vcs/vcs'
import os, { tmpdir } from 'node:os'
import { SnapshotManager } from '@vitest/snapshot/manager'
import { deepClone, deepMerge, nanoid, toArray } from '@vitest/utils/helpers'
import { serializeValue } from '@vitest/utils/serialize'
import { join, normalize, relative } from 'pathe'
import { version } from '../../package.json' with { type: 'json' }
import { distDir } from '../paths'
import { createTagsFilter } from '../runtime/runner/utils/tags'
import { limitConcurrency } from '../utils/limit-concurrency'
import { NativeModuleRunner } from '../utils/nativeModuleRunner'
import { convertTasksToEvents, getTasks, hasFailed, interpretTaskModes, someTasksAreOnly } from '../utils/tasks'
import { Traces } from '../utils/traces'
import { astCollectTests, createFailedFileTask } from './ast-collect'
import { BrowserSessions } from './browser/sessions'
import { VitestCache } from './cache'
import { FileSystemModuleCache } from './cache/fsModuleCache'
import { matchesProjectFilter, resolveConfig } from './config/resolveConfig'
import { getCoverageProvider } from './coverage'
import { createFetchModuleFunction } from './environments/fetchModule'
import { ServerModuleRunner } from './environments/serverRunner'
import { FilesNotFoundError } from './errors'
import { collectModuleDurationsDiagnostic, collectSourceModulesLocations } from './module-diagnostic'
import { createClusterServer } from './plugins/browserLoader'
import { createPool } from './pool'
import { TestProject } from './project'
import { attachProjectsFromEntries, resolveAndAttachProjects } from './projects/resolveProjects'
import { BlobReporter, readBlobs } from './reporters/blob'
import { HangingProcessReporter } from './reporters/hanging-process'
import { createReport } from './reporters/report'
import { createReporters } from './reporters/utils'
import { VitestResolver } from './resolver'
import { VitestSpecifications } from './specifications'
import { StateManager } from './state'
import { populateProjectsTags } from './tags'
import { TestRun } from './test-run'
import { loadVCSProvider } from './vcs/vcs'
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
   * new Vitest({
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
  /**
   * The version control system provider used to detect changed files.
   * This is used with the `--changed` flag to determine which test files to run.
   * By default, Vitest uses Git. You can provide a custom implementation via
   * `experimental.vcsProvider` in your config.
   */
  public vcs!: VCSProvider

  // these values are set after the config is resolved,
  // but Vitest instance is not accessible anywhere before that
  /**
   * The global config.
   */
  public config!: ResolvedConfig
  /**
   * Resolved global vite config.
   */
  public viteConfig!: ResolvedViteConfig
  /**
   * Global Vite's dev server instance.
   */
  public vite!: ViteDevServer
  /**
   * The global test state manager.
   * @experimental The State API is experimental and not subject to semver.
   */
  public state!: StateManager
  /**
   * The global snapshot manager. You can access the current state on `snapshot.summary`.
   */
  public snapshot!: SnapshotManager
  /**
   * Test results and test file stats cache. Primarily used by the sequencer to sort tests.
   */
  public cache!: VitestCache

  /** @internal */ configOverride: Partial<ResolvedConfig> = {}
  /** @internal */ filenamePattern?: string[]
  /** @internal */ runningPromise?: Promise<TestRunResult>
  /** @internal */ closingPromise?: Promise<void>
  /** @internal */ cancelPromise?: Promise<void | void[]>
  /** @internal */ isCancelling = false
  /** @internal */ coreWorkspaceProject: TestProject | undefined
  /**
   * When the root config is itself browser-enabled (no `projects`), the root
   * Vite server is the single browser server and this is its parent browser
   * project (assigned to `coreWorkspaceProject._parentBrowser`).
   * @internal
   */
  _rootBrowserParent: ParentProjectBrowser | undefined
  /** @internal */ _browserSessions = new BrowserSessions()
  /** @internal */ reporters: Reporter[] = []
  /** @internal */ runner!: ModuleRunner
  /** @internal */ _testRun: TestRun
  /** @internal */ _resolver!: VitestResolver
  /** @internal */ _fetcher!: VitestFetchFunction
  /** @internal */ _fsCache!: FileSystemModuleCache
  /** @internal */ _tmpDir = join(tmpdir(), nanoid())
  /** @internal */ _traces!: Traces
  /** @internal */ _harness: PluginHarness

  private isFirstRun = true
  private restartsCount = 0

  private readonly specifications: VitestSpecifications
  private pool: ProcessPool | undefined
  private _coverageProvider?: CoverageProvider | null | undefined

  /**
   * @deprecated Do not rely on this property, it's always `test`. Scheduled to be removed in the next major.
   */
  public readonly mode = 'test'

  constructor(
    harness: PluginHarness,
    viteConfig: ResolvedViteConfig,
  ) {
    this._harness = harness
    this.viteConfig = viteConfig
    this.config = viteConfig.test
    this.logger = harness.logger.setVitest(this)
    this.packageInstaller = harness.packageInstaller
    this.specifications = new VitestSpecifications(this)
    this.watcher = new VitestWatcher(this).onWatcherRerun(file =>
      this.scheduleRerun(file), // TODO: error handling
    )
    harness.setVitest(this)
    this._testRun = new TestRun(this)
  }

  private _onRestartListeners: OnServerRestartHandler[] = []
  private _onClose: (() => Awaitable<void>)[] = []
  private _onSetServer: OnServerRestartHandler[] = []
  private _onCancelListeners = new Set<(reason: CancelReason) => Awaitable<void>>()
  private _onUserTestsRerun: OnTestsRerunHandler[] = []
  private _onFilterWatchedSpecification: ((spec: TestSpecification) => boolean)[] = []

  /**
   * @internal
   */
  async _start(config: ResolvedViteConfig): Promise<void> {
    this._setRootConfig(config)
    await this._attachRootServer()
    await this._attachProjectServers()
    this._harness.setVitest(this)
  }

  /**
   * @internal
   */
  _setRootConfig(config: ResolvedViteConfig): void {
    this.watcher.unregisterWatcher()
    clearTimeout(this._rerunTimer)
    this.restartsCount += 1
    this.pool?.close?.()
    this.pool = undefined
    this.closingPromise = undefined
    this.projects = []
    this.runningPromise = undefined
    this.coreWorkspaceProject = undefined
    this._rootBrowserParent = undefined
    this.specifications.clearCache()
    this._coverageProvider = undefined
    this._onUserTestsRerun = []

    this.viteConfig = config
    this.config = config.test
    const resolved = config.test

    this.state = new StateManager({
      onUnhandledError: resolved.onUnhandledError,
    })
    this.cache = new VitestCache(this.logger)
    const otelSdkPath = this.config.experimental.openTelemetry?.sdkPath
    this._traces = new Traces({
      enabled: !!this.config.experimental.openTelemetry?.enabled,
      sdkPath: otelSdkPath,
      watchMode: this.config.watch,
    })
    this._fsCache = new FileSystemModuleCache(this)
    this.snapshot = new SnapshotManager({ ...resolved.snapshotOptions })
    this._resolver = new VitestResolver(this.viteConfig.cacheDir, resolved)
    this._fetcher = createFetchModuleFunction(
      this._resolver,
      resolved,
      this._fsCache,
      this._traces,
      this._tmpDir,
    )
  }

  private async _restart(reason?: string) {
    await Promise.all(this._onRestartListeners.map(fn => fn(reason)))
    this.report('onServerRestart', reason)
    await this.close()
    // harness mimics `vitest` access like in `node/create.ts`
    this._harness.setVitest(undefined)
    const config = await resolveConfig(
      this.config.cliOptions,
      this.config.viteOverrides,
      this._harness,
    )
    this._harness.setVitest(this)
    await this._start(config)
  }

  /**
   * @internal
   */
  async _attachRootServer(): Promise<void> {
    const resolved = this.config
    // For a root-level browser config (no `projects`) this builds the single
    // browser server; otherwise it just creates the Vite server.
    const { server, parent } = await createClusterServer(this, this.viteConfig, resolved)
    this.vite = server
    this._rootBrowserParent = parent

    const environment = server.environments.__vitest__
    this.runner = resolved.experimental.viteModuleRunner === false
      ? new NativeModuleRunner(resolved.root)
      : new ServerModuleRunner(
          environment,
          this._fetcher,
          resolved,
        )
    this.vcs = await loadVCSProvider(this.runner, resolved.experimental.vcsProvider)

    if (resolved.watch) {
      this.watcher.registerWatcher()

      // hijack server restart — re-run the full pipeline rather than letting
      // Vite recreate the server in isolation, so Vitest's own resolution
      // re-runs too.
      server.restart = async () => {
        await this._restart()
      }

      // since we set `server.hmr: false`, Vite does not auto restart itself
      server.watcher.on('change', async (file) => {
        file = normalize(file)
        const isConfig = file === server.config.configFile
          || this.projects.some(p => p.vite.config.configFile === file)
        if (isConfig) {
          await this._restart('config')
        }
      })

      if (process.env.VITE_TEST_WATCHER_DEBUG) {
        server.watcher.on('ready', () => {
          // eslint-disable-next-line no-console
          console.log('[debug] watcher is ready')
        })
      }
    }

    // API setup (watch mode only). Skipped when the root server is itself a
    // browser server: `createClusterServer` already wires the browser RPC and,
    // for `browser.ui`, the API server, on the same httpServer.
    if (resolved.api && resolved.watch && !this._rootBrowserParent) {
      (await import('../api/setup')).setup(this)
    }

    // In run mode we don't need the watcher; closing it improves performance (#415).
    if (!resolved.watch) {
      await server.watcher.close()
    }

    this.cache.results.setConfig(resolved.root, resolved.cache)
    try {
      await this.cache.results.readFromCache()
    }
    catch { }
  }

  /**
   * Phase B (projects) — instantiate `TestProject`s from the resolved entries
   * and create their Vite servers, deduping by `viteConfig` identity. Run
   * `configureVitest` hooks. Validate filters and project resolution. Set up
   * the core workspace project, populate tags, build reporters.
   *
   * @internal
   */
  async _attachProjectServers(): Promise<void> {
    const resolved = this.config
    const entries = resolved.projects || []
    this.projects = await attachProjectsFromEntries(this, entries)

    // `--benchmark` (CLI `benchmarkOnly`) narrows `vitest.projects` to only
    // the benchmark variants produced by the benchmark expansion step.
    if (resolved.cliOptions.benchmarkOnly) {
      this.projects = this.projects.filter(p => p.config.benchmark.enabled)
    }

    await Promise.all(this.projects.flatMap((project) => {
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

    if (resolved.cliOptions.browser?.enabled) {
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
        if (resolved.browser.enabled && !resolved.browser.instances?.length) {
          error += ` Please, check that you specified the "browser.instances" option.`
        }
        throw new Error(error)
      }
    }

    if (!this.coreWorkspaceProject) {
      this.coreWorkspaceProject = TestProject._createBasicProject(this)
    }

    if (resolved.testNamePattern) {
      this.configOverride.testNamePattern = resolved.testNamePattern
    }

    // populate will merge all configs into every project,
    // we don't want that when just listing tags
    if (!resolved.listTags) {
      populateProjectsTags(this.coreWorkspaceProject, this.projects)
    }

    this.reporters = await createReporters(resolved.reporters, this)

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
    const projects = await resolveAndAttachProjects(
      this._harness,
      Array.isArray(config) ? config : [config],
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

  public get serializedRootConfig(): SerializedRootConfig {
    return {
      ...this.getRootProject().serializedConfig,
      projects: this.projects.map(project => project.serializedConfig),
    }
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

      const { files, errors, coverages, executionTimes, transformTimes } = await readBlobs(this.version, directory || this.config.mergeReports, this.projects)
      this.state.blobs = { files, errors, coverages, executionTimes, transformTimes }
      this.state.transformTime = transformTimes.reduce((a, b) => a + b, 0)

      await this.report('onInit', this)

      const specifications: TestSpecification[] = []
      for (const file of files) {
        const project = this.getProjectByName(file.projectName || '')
        const specification = project.createSpecification(file.filepath, undefined, file.pool, file.id)
        specifications.push(specification)
      }

      await this._testRun.start(specifications)
      await this.coverageProvider?.onTestRunStart?.()

      for (const file of files) {
        await this._reportFileTask(file)
      }

      // append errors thrown during reporter event replay during merge reports
      const unhandledErrors = [...errors, ...this.state.getUnhandledErrors()]
      this._checkUnhandledErrors(unhandledErrors)
      await this._testRun.end(specifications, unhandledErrors)
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
    await this._testRun.enqueued(project, file).catch((error) => {
      this.state.catchError(serializeValue(error), 'Unhandled Reporter Error')
    })
    await this._testRun.collected(project, [file]).catch((error) => {
      this.state.catchError(serializeValue(error), 'Unhandled Reporter Error')
    })

    const logs: UserConsoleLog[] = []

    const { packs, events } = convertTasksToEvents(file, (task) => {
      if (task.logs) {
        logs.push(...task.logs)
      }
    })

    logs.sort((log1, log2) => log1.time - log2.time)

    for (const log of logs) {
      await this._testRun.log(log).catch((error) => {
        this.state.catchError(serializeValue(error), 'Unhandled Reporter Error')
      })
    }

    await this._testRun.updated(packs, events).catch((error) => {
      this.state.catchError(serializeValue(error), 'Unhandled Reporter Error')
    })
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
      let specifications = await this._traces.$(
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

      if (this.config.experimental.preParse) {
        // This populates specification.testModule with parsed information
        await this.experimental_parseSpecifications(specifications)
        specifications = specifications.filter(({ testModule }) => {
          return !testModule || testModule.task.mode !== 'skip'
        })
      }

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
          throw new FilesNotFoundError()
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
   * @deprecated use `standalone()` instead
   */
  init(): Promise<void> {
    this.logger.deprecate('`vitest.init()` is deprecated. Use `vitest.standalone()` instead.')
    return this.standalone()
  }

  /**
   * Initialize reporters and the coverage provider. This method doesn't run any tests.
   * If the `--watch` flag is provided, Vitest will still run changed tests even if this method was not called.
   */
  async standalone(): Promise<void> {
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

      await Promise.all(this.projects.map(project => project._standalone()))

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
    const concurrency = options?.concurrency ?? (typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus().length)
    const limit = limitConcurrency(concurrency)

    // Phase 1: parse all files in parallel (without mode interpretation)
    const results = await Promise.all(specifications.map(specification =>
      limit(async () => {
        const file = await astCollectTests(specification.project, specification.moduleId).catch((error) => {
          return createFailedFileTask(specification.project, specification.moduleId, error)
        })
        return { file, specification }
      }),
    ))

    const tagsFilter = this.config.tagsFilter
      ? createTagsFilter(this.config.tagsFilter, this.config.tags)
      : undefined
    // Phase 2: cross-file .only resolution
    const globalHasOnly = results.some(({ file }) => someTasksAreOnly(file))
    for (const { file, specification } of results) {
      const config = specification.project.config
      interpretTaskModes(
        file,
        config.testNamePattern,
        specification.testLines,
        specification.testIds,
        tagsFilter,
        globalHasOnly,
        false,
        config.allowOnly,
      )
      this.state.collectFiles(specification.project, [file])
    }

    return results.map(({ file }) => this.state.getReportedEntity(file) as TestModule)
  }

  public async experimental_parseSpecification(specification: TestSpecification): Promise<TestModule> {
    const file = await astCollectTests(specification.project, specification.moduleId).catch((error) => {
      return createFailedFileTask(specification.project, specification.moduleId, error)
    })
    const config = specification.project.config
    const hasOnly = someTasksAreOnly(file)
    const tagsFilter = this.config.tagsFilter
      ? createTagsFilter(this.config.tagsFilter, this.config.tags)
      : undefined
    interpretTaskModes(
      file,
      config.testNamePattern,
      specification.testLines,
      specification.testIds,
      tagsFilter,
      hasOnly,
      false,
      config.allowOnly,
    )
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
      this.config.cliOptions.project = undefined
    }
    else {
      this.config.cliOptions.project = [pattern]
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
          closePromises.push(this.coreWorkspaceProject.close().then(() => this.vite = undefined as any))
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
          const runningServers = [this.vite, ...this.projects.map(p => p.vite)].filter(Boolean).length

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
    const projects = this.config?.project || this.config.cliOptions?.project
    return matchesProjectFilter(toArray(projects), name)
  }

  /**
   * Create a report that's scoped to a specific reporter directory.
   */
  createReport(scope: string): Report {
    return createReport(this, scope)
  }
}

export type OnServerRestartHandler = (reason?: string) => Promise<void> | void
export type OnTestsRerunHandler = (testFiles: TestSpecification[]) => Promise<void> | void
