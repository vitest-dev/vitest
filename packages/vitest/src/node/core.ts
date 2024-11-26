import type { CancelReason, File, TaskResultPack } from '@vitest/runner'
import type { Writable } from 'node:stream'
import type { ViteDevServer } from 'vite'
import type { defineWorkspace } from 'vitest/config'
import type { RunnerTask, RunnerTestSuite } from '../public'
import type { SerializedCoverageConfig } from '../runtime/config'
import type { ArgumentsType, OnServerRestartHandler, OnTestsRerunHandler, ProvidedContext, UserConsoleLog } from '../types/general'
import type { ProcessPool, WorkspaceSpec } from './pool'
import type { TestSpecification } from './spec'
import type { ResolvedConfig, UserConfig, VitestRunMode } from './types/config'
import type { CoverageProvider } from './types/coverage'
import type { Reporter } from './types/reporter'
import { existsSync, promises as fs, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getTasks, hasFailed } from '@vitest/runner/utils'
import { SnapshotManager } from '@vitest/snapshot/manager'
import { noop, slash, toArray } from '@vitest/utils'
import mm from 'micromatch'
import { dirname, join, normalize, relative } from 'pathe'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { version } from '../../package.json' with { type: 'json' }
import { WebSocketReporter } from '../api/setup'
import { defaultBrowserPort, workspacesFiles as workspaceFiles } from '../constants'
import { getCoverageProvider } from '../integrations/coverage'
import { distDir } from '../paths'
import { wildcardPatternToRegExp } from '../utils/base'
import { VitestCache } from './cache'
import { groupFilters, parseFilter } from './cli/filter'
import { resolveConfig } from './config/resolveConfig'
import { FilesNotFoundError, GitNotFoundError, IncludeTaskLocationDisabledError, LocationFilterFileNotFoundError } from './errors'
import { Logger } from './logger'
import { VitestPackageInstaller } from './packageInstaller'
import { createPool } from './pool'
import { TestProject } from './project'
import { BlobReporter, readBlobs } from './reporters/blob'
import { createBenchmarkReporters, createReporters } from './reporters/utils'
import { StateManager } from './state'
import { resolveWorkspace } from './workspace/resolveWorkspace'

const WATCHER_DEBOUNCE = 100

export interface VitestOptions {
  packageInstaller?: VitestPackageInstaller
  stdin?: NodeJS.ReadStream
  stdout?: NodeJS.WriteStream | Writable
  stderr?: NodeJS.WriteStream | Writable
}

export class Vitest {
  version = version

  config: ResolvedConfig = undefined!
  configOverride: Partial<ResolvedConfig> = {}

  server: ViteDevServer = undefined!
  state: StateManager = undefined!
  snapshot: SnapshotManager = undefined!
  cache: VitestCache = undefined!
  reporters: Reporter[] = undefined!
  coverageProvider: CoverageProvider | null | undefined
  logger: Logger
  pool: ProcessPool | undefined

  vitenode: ViteNodeServer = undefined!

  invalidates: Set<string> = new Set()
  changedTests: Set<string> = new Set()
  watchedTests: Set<string> = new Set()
  filenamePattern?: string
  runningPromise?: Promise<void>
  closingPromise?: Promise<void>
  isCancelling = false

  isFirstRun = true
  restartsCount = 0
  runner: ViteNodeRunner = undefined!

  public packageInstaller: VitestPackageInstaller

  /** @internal */
  public coreWorkspaceProject!: TestProject

  /** @private */
  public resolvedProjects: TestProject[] = []
  public projects: TestProject[] = []

  public distPath = distDir

  private _cachedSpecs = new Map<string, TestSpecification[]>()
  private _workspaceConfigPath?: string

  /** @deprecated use `_cachedSpecs` */
  projectTestFiles = this._cachedSpecs

  /** @private */
  public _browserLastPort = defaultBrowserPort

  /** @internal */
  public _options: UserConfig = {}

  constructor(
    public readonly mode: VitestRunMode,
    options: VitestOptions = {},
  ) {
    this.logger = new Logger(this, options.stdout, options.stderr)
    this.packageInstaller = options.packageInstaller || new VitestPackageInstaller()
  }

  private _onRestartListeners: OnServerRestartHandler[] = []
  private _onClose: (() => Awaited<unknown>)[] = []
  private _onSetServer: OnServerRestartHandler[] = []
  private _onCancelListeners: ((reason: CancelReason) => Promise<void> | void)[] = []
  private _onUserTestsRerun: OnTestsRerunHandler[] = []

  async setServer(options: UserConfig, server: ViteDevServer, cliOptions: UserConfig) {
    this._options = options
    this.unregisterWatcher?.()
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
    this._cachedSpecs.clear()
    this._onUserTestsRerun = []

    const resolved = resolveConfig(this.mode, options, server.config, this.logger)

    this.server = server
    this.config = resolved
    this.state = new StateManager()
    this.cache = new VitestCache(this.version)
    this.snapshot = new SnapshotManager({ ...resolved.snapshotOptions })

    if (this.config.watch) {
      this.registerWatcher()
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

    this.reporters = resolved.mode === 'benchmark'
      ? await createBenchmarkReporters(toArray(resolved.benchmark?.reporters), this.runner)
      : await createReporters(resolved.reporters, this)

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
    }
    if (!this.coreWorkspaceProject) {
      this.coreWorkspaceProject = TestProject._createBasicProject(this)
    }

    if (this.config.testNamePattern) {
      this.configOverride.testNamePattern = this.config.testNamePattern
    }

    await Promise.all(this._onSetServer.map(fn => fn()))
  }

  public provide<T extends keyof ProvidedContext & string>(key: T, value: ProvidedContext[T]) {
    this.getRootTestProject().provide(key, value)
  }

  /**
   * @internal
   */
  _createRootProject() {
    this.coreWorkspaceProject = TestProject._createBasicProject(this)
    return this.coreWorkspaceProject
  }

  public getRootTestProject(): TestProject {
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
    return this.projects.find(p => p.name === projectName)
      || this.getRootTestProject()
      || this.projects[0]
  }

  public getProjectByName(name: string = '') {
    return this.projects.find(p => p.name === name)
      || this.coreWorkspaceProject
      || this.projects[0]
  }

  private async resolveWorkspaceConfigPath(): Promise<string | undefined> {
    if (typeof this.config.workspace === 'string') {
      return this.config.workspace
    }

    const configDir = this.server.config.configFile
      ? dirname(this.server.config.configFile)
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

  private async resolveWorkspace(cliOptions: UserConfig) {
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
      return [this._createRootProject()]
    }

    const workspaceModule = await this.runner.executeFile(workspaceConfigPath) as {
      default: ReturnType<typeof defineWorkspace>
    }

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

  private async initCoverageProvider() {
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

  async mergeReports() {
    if (this.reporters.some(r => r instanceof BlobReporter)) {
      throw new Error('Cannot merge reports when `--reporter=blob` is used. Remove blob reporter from the config first.')
    }

    const { files, errors, coverages } = await readBlobs(this.version, this.config.mergeReports, this.projects)

    await this.report('onInit', this)
    await this.report('onPathsCollected', files.flatMap(f => f.filepath))

    const workspaceSpecs = new Map<TestProject, File[]>()
    for (const file of files) {
      const project = this.getProjectByName(file.projectName)
      const specs = workspaceSpecs.get(project) || []
      specs.push(file)
      workspaceSpecs.set(project, specs)
    }

    for (const [project, files] of workspaceSpecs) {
      const filepaths = files.map(f => f.filepath)
      this.state.clearFiles(project, filepaths)
      files.forEach((file) => {
        file.logs?.forEach(log => this.state.updateUserLog(log))
      })
      this.state.collectFiles(project, files)
    }

    await this.report('onCollected', files).catch(noop)

    for (const file of files) {
      const logs: UserConsoleLog[] = []
      const taskPacks: TaskResultPack[] = []

      const tasks = getTasks(file)
      for (const task of tasks) {
        if (task.logs) {
          logs.push(...task.logs)
        }
        taskPacks.push([task.id, task.result, task.meta])
      }
      logs.sort((log1, log2) => log1.time - log2.time)

      for (const log of logs) {
        await this.report('onUserConsoleLog', log).catch(noop)
      }

      await this.report('onTaskUpdate', taskPacks).catch(noop)
    }

    if (hasFailed(files)) {
      process.exitCode = 1
    }

    this.checkUnhandledErrors(errors)
    await this.report('onFinished', files, errors)
    await this.initCoverageProvider()
    await this.coverageProvider?.mergeReports?.(coverages)
  }

  async collect(filters?: string[]) {
    this._onClose = []

    const files = await this.filterTestsBySource(
      await this.globTestFiles(filters),
    )

    // if run with --changed, don't exit if no tests are found
    if (!files.length) {
      return { tests: [], errors: [] }
    }

    await this.collectFiles(files)

    return {
      tests: this.state.getFiles(),
      errors: this.state.getUnhandledErrors(),
    }
  }

  async listFiles(filters?: string[]) {
    const files = await this.filterTestsBySource(
      await this.globTestFiles(filters),
    )

    return files
  }

  async start(filters?: string[]) {
    this._onClose = []

    try {
      await this.initCoverageProvider()
      await this.coverageProvider?.clean(this.config.coverage.clean)
    }
    finally {
      await this.report('onInit', this)
    }

    const files = await this.filterTestsBySource(
      await this.globTestFiles(filters),
    )

    // if run with --changed, don't exit if no tests are found
    if (!files.length) {
      // Report coverage for uncovered files
      const coverage = await this.coverageProvider?.generateCoverage?.({ allTestsRun: true })
      await this.reportCoverage(coverage, true)

      this.logger.printNoTestFound(filters)

      if (!this.config.watch || !(this.config.changed || this.config.related?.length)) {
        const exitCode = this.config.passWithNoTests ? 0 : 1
        process.exitCode = exitCode
        throw new FilesNotFoundError(this.mode)
      }
    }

    if (files.length) {
      // populate once, update cache on watch
      await this.cache.stats.populateStats(this.config.root, files)

      await this.runFiles(files, true)
    }

    if (this.config.watch) {
      await this.report('onWatcherStart')
    }
  }

  async init() {
    this._onClose = []

    try {
      await this.initCoverageProvider()
      await this.coverageProvider?.clean(this.config.coverage.clean)
    }
    finally {
      await this.report('onInit', this)
    }

    // populate test files cache so watch mode can trigger a file rerun
    await this.globTestFiles()

    if (this.config.watch) {
      await this.report('onWatcherStart')
    }
  }

  private async getTestDependencies(spec: WorkspaceSpec, deps = new Set<string>()) {
    const addImports = async (project: TestProject, filepath: string) => {
      if (deps.has(filepath)) {
        return
      }
      deps.add(filepath)

      const mod = project.vite.moduleGraph.getModuleById(filepath)
      const transformed = mod?.ssrTransformResult || await project.vitenode.transformRequest(filepath)
      if (!transformed) {
        return
      }
      const dependencies = [...transformed.deps || [], ...transformed.dynamicDeps || []]
      await Promise.all(dependencies.map(async (dep) => {
        const path = await project.vite.pluginContainer.resolveId(dep, filepath, { ssr: true })
        const fsPath = path && !path.external && path.id.split('?')[0]
        if (fsPath && !fsPath.includes('node_modules') && !deps.has(fsPath) && existsSync(fsPath)) {
          await addImports(project, fsPath)
        }
      }))
    }

    await addImports(spec.project, spec.moduleId)
    deps.delete(spec.moduleId)

    return deps
  }

  async filterTestsBySource(specs: WorkspaceSpec[]) {
    if (this.config.changed && !this.config.related) {
      const { VitestGit } = await import('./git')
      const vitestGit = new VitestGit(this.config.root)
      const related = await vitestGit.findChangedFiles({
        changedSince: this.config.changed,
      })
      if (!related) {
        process.exitCode = 1
        throw new GitNotFoundError()
      }
      this.config.related = Array.from(new Set(related))
    }

    const related = this.config.related
    if (!related) {
      return specs
    }

    const forceRerunTriggers = this.config.forceRerunTriggers
    if (forceRerunTriggers.length && mm(related, forceRerunTriggers).length) {
      return specs
    }

    // don't run anything if no related sources are found
    // if we are in watch mode, we want to process all tests
    if (!this.config.watch && !related.length) {
      return []
    }

    const testGraphs = await Promise.all(
      specs.map(async (spec) => {
        const deps = await this.getTestDependencies(spec)
        return [spec, deps] as const
      }),
    )

    const runningTests = []

    for (const [filepath, deps] of testGraphs) {
      // if deps or the test itself were changed
      if (related.some(path => path === filepath[1] || deps.has(path))) {
        runningTests.push(filepath)
      }
    }

    return runningTests
  }

  /**
   * @deprecated remove when vscode extension supports "getFileWorkspaceSpecs"
   */
  getProjectsByTestFile(file: string) {
    return this.getFileWorkspaceSpecs(file) as WorkspaceSpec[]
  }

  getFileWorkspaceSpecs(file: string) {
    const _cached = this._cachedSpecs.get(file)
    if (_cached) {
      return _cached
    }

    const specs: TestSpecification[] = []
    for (const project of this.projects) {
      if (project.isTestFile(file)) {
        specs.push(project.createSpecification(file))
      }
      if (project.isTypecheckFile(file)) {
        specs.push(project.createSpecification(file, 'typescript'))
      }
    }
    specs.forEach(spec => this.ensureSpecCached(spec))
    return specs
  }

  async initializeGlobalSetup(paths: TestSpecification[]) {
    const projects = new Set(paths.map(spec => spec.project))
    const coreProject = this.getRootTestProject()
    if (!projects.has(coreProject)) {
      projects.add(coreProject)
    }
    for (const project of projects) {
      await project._initializeGlobalSetup()
    }
  }

  async runFiles(specs: TestSpecification[], allTestsRun: boolean) {
    const filepaths = specs.map(spec => spec.moduleId)
    this.state.collectPaths(filepaths)

    await this.report('onPathsCollected', filepaths)
    await this.report('onSpecsCollected', specs.map(spec => spec.toJSON()))

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

        const invalidates = Array.from(this.invalidates)
        this.invalidates.clear()
        this.snapshot.clear()
        this.state.clearErrors()

        if (!this.isFirstRun && this.config.coverage.cleanOnRerun) {
          await this.coverageProvider?.clean()
        }

        await this.initializeGlobalSetup(specs)

        try {
          await this.pool.runTests(specs as WorkspaceSpec[], invalidates)
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
      }
      finally {
        // can be duplicate files if different projects are using the same file
        const files = Array.from(new Set(specs.map(spec => spec.moduleId)))
        const errors = this.state.getUnhandledErrors()
        const coverage = await this.coverageProvider?.generateCoverage({ allTestsRun })

        this.checkUnhandledErrors(errors)
        await this.report('onFinished', this.state.getFiles(files), errors, coverage)
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

  async collectFiles(specs: WorkspaceSpec[]) {
    const filepaths = specs.map(spec => spec.moduleId)
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

      const invalidates = Array.from(this.invalidates)
      this.invalidates.clear()
      this.snapshot.clear()
      this.state.clearErrors()

      await this.initializeGlobalSetup(specs)

      try {
        await this.pool.collectTests(specs, invalidates)
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
    })()
      .finally(() => {
        this.runningPromise = undefined

        // all subsequent runs will treat this as a fresh run
        this.config.changed = false
        this.config.related = undefined
      })

    return await this.runningPromise
  }

  async cancelCurrentRun(reason: CancelReason) {
    this.isCancelling = true
    await Promise.all(this._onCancelListeners.splice(0).map(listener => listener(reason)))
  }

  async initBrowserServers() {
    await Promise.all(this.projects.map(p => p._initBrowserServer()))
  }

  async rerunFiles(files: string[] = this.state.getFilepaths(), trigger?: string, allTestsRun = true, resetTestNamePattern = false) {
    if (resetTestNamePattern) {
      this.configOverride.testNamePattern = undefined
    }

    if (this.filenamePattern) {
      const filteredFiles = await this.globTestFiles([this.filenamePattern])
      files = files.filter(file => filteredFiles.some(f => f[1] === file))
    }

    await Promise.all([
      this.report('onWatcherRerun', files, trigger),
      ...this._onUserTestsRerun.map(fn => fn(files)),
    ])
    await this.runFiles(files.flatMap(file => this.getProjectsByTestFile(file)), allTestsRun)

    await this.report('onWatcherStart', this.state.getFiles(files))
  }

  private isSuite(task: RunnerTask): task is RunnerTestSuite {
    return Object.hasOwnProperty.call(task, 'tasks')
  }

  async rerunTask(id: string) {
    const task = this.state.idMap.get(id)
    if (!task) {
      throw new Error(`Task ${id} was not found`)
    }
    await this.changeNamePattern(
      task.name,
      [task.file.filepath],
      this.isSuite(task) ? 'rerun suite' : 'rerun test',
    )
  }

  async changeProjectName(pattern: string) {
    if (pattern === '') {
      delete this.configOverride.project
    }
    else {
      this.configOverride.project = pattern
    }

    this.projects = this.resolvedProjects.filter(p => p.name === pattern)
    const files = (await this.globTestSpecs()).map(spec => spec.moduleId)
    await this.rerunFiles(files, 'change project filter', pattern === '')
  }

  async changeNamePattern(pattern: string, files: string[] = this.state.getFilepaths(), trigger?: string) {
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

  async changeFilenamePattern(pattern: string, files: string[] = this.state.getFilepaths()) {
    this.filenamePattern = pattern

    const trigger = this.filenamePattern ? 'change filename pattern' : 'reset filename pattern'

    await this.rerunFiles(files, trigger, pattern === '')
  }

  async rerunFailed() {
    await this.rerunFiles(this.state.getFailedFilepaths(), 'rerun failed', false)
  }

  async updateSnapshot(files?: string[]) {
    // default to failed files
    files = files || [
      ...this.state.getFailedFilepaths(),
      ...this.snapshot.summary.uncheckedKeysByFile.map(s => s.filePath),
    ]

    this.configOverride.snapshotOptions = {
      updateSnapshot: 'all',
      // environment is resolved inside a worker thread
      snapshotEnvironment: null as any,
    }

    try {
      await this.rerunFiles(files, 'update snapshot', false)
    }
    finally {
      delete this.configOverride.snapshotOptions
    }
  }

  private _rerunTimer: any
  private async scheduleRerun(triggerId: string[]) {
    const currentCount = this.restartsCount
    clearTimeout(this._rerunTimer)
    await this.runningPromise
    clearTimeout(this._rerunTimer)

    // server restarted
    if (this.restartsCount !== currentCount) {
      return
    }

    this._rerunTimer = setTimeout(async () => {
      // run only watched tests
      if (this.watchedTests.size) {
        this.changedTests.forEach((test) => {
          if (!this.watchedTests.has(test)) {
            this.changedTests.delete(test)
          }
        })
      }

      if (this.changedTests.size === 0) {
        this.invalidates.clear()
        return
      }

      // server restarted
      if (this.restartsCount !== currentCount) {
        return
      }

      this.isFirstRun = false

      this.snapshot.clear()
      let files = Array.from(this.changedTests)

      if (this.filenamePattern) {
        const filteredFiles = await this.globTestFiles([this.filenamePattern])
        files = files.filter(file => filteredFiles.some(f => f[1] === file))

        // A file that does not match the current filename pattern was changed
        if (files.length === 0) {
          return
        }
      }

      this.changedTests.clear()

      const triggerIds = new Set(triggerId.map(id => relative(this.config.root, id)))
      const triggerLabel = Array.from(triggerIds).join(', ')
      await Promise.all([
        this.report('onWatcherRerun', files, triggerLabel),
        ...this._onUserTestsRerun.map(fn => fn(files)),
      ])

      await this.runFiles(files.flatMap(file => this.getProjectsByTestFile(file)), false)

      await this.report('onWatcherStart', this.state.getFiles(files))
    }, WATCHER_DEBOUNCE)
  }

  public getModuleProjects(filepath: string) {
    return this.projects.filter((project) => {
      return project.getModulesByFilepath(filepath).size
      // TODO: reevaluate || project.browser?.moduleGraph.getModulesByFile(id)?.size
    })
  }

  /**
   * Watch only the specified tests. If no tests are provided, all tests will be watched.
   */
  public watchTests(tests: string[]) {
    this.watchedTests = new Set(
      tests.map(test => slash(test)),
    )
  }

  private updateLastChanged(filepath: string) {
    const projects = this.getModuleProjects(filepath)
    projects.forEach(({ server, browser }) => {
      const serverMods = server.moduleGraph.getModulesByFile(filepath)
      serverMods?.forEach(mod => server.moduleGraph.invalidateModule(mod))

      if (browser) {
        const browserMods = browser.vite.moduleGraph.getModulesByFile(filepath)
        browserMods?.forEach(mod => browser.vite.moduleGraph.invalidateModule(mod))
      }
    })
  }

  onChange = (id: string) => {
    id = slash(id)
    this.logger.clearHighlightCache(id)
    this.updateLastChanged(id)
    const needsRerun = this.handleFileChanged(id)
    if (needsRerun.length) {
      this.scheduleRerun(needsRerun)
    }
  }

  onUnlink = (id: string) => {
    id = slash(id)
    this.logger.clearHighlightCache(id)
    this.invalidates.add(id)

    if (this.state.filesMap.has(id)) {
      this.state.filesMap.delete(id)
      this.cache.results.removeFromCache(id)
      this.cache.stats.removeStats(id)
      this.changedTests.delete(id)
      this.report('onTestRemoved', id)
    }
  }

  onAdd = async (id: string) => {
    id = slash(id)
    this.updateLastChanged(id)
    const fileContent = readFileSync(id, 'utf-8')

    const matchingProjects: TestProject[] = []
    this.projects.forEach((project) => {
      if (project.matchesTestGlob(id, fileContent)) {
        matchingProjects.push(project)
        project._markTestFile(id)
      }
    })

    if (matchingProjects.length > 0) {
      this.changedTests.add(id)
      this.scheduleRerun([id])
    }
    else {
      // it's possible that file was already there but watcher triggered "add" event instead
      const needsRerun = this.handleFileChanged(id)
      if (needsRerun.length) {
        this.scheduleRerun(needsRerun)
      }
    }
  }

  checkUnhandledErrors(errors: unknown[]) {
    if (errors.length && !this.config.dangerouslyIgnoreUnhandledErrors) {
      process.exitCode = 1
    }
  }

  private unregisterWatcher = noop
  private registerWatcher() {
    const watcher = this.server.watcher

    if (this.config.forceRerunTriggers.length) {
      watcher.add(this.config.forceRerunTriggers)
    }

    watcher.on('change', this.onChange)
    watcher.on('unlink', this.onUnlink)
    watcher.on('add', this.onAdd)

    this.unregisterWatcher = () => {
      watcher.off('change', this.onChange)
      watcher.off('unlink', this.onUnlink)
      watcher.off('add', this.onAdd)
      this.unregisterWatcher = noop
    }
  }

  /**
   * @returns A value indicating whether rerun is needed (changedTests was mutated)
   */
  private handleFileChanged(filepath: string): string[] {
    if (this.changedTests.has(filepath) || this.invalidates.has(filepath)) {
      return []
    }

    if (mm.isMatch(filepath, this.config.forceRerunTriggers)) {
      this.state.getFilepaths().forEach(file => this.changedTests.add(file))
      return [filepath]
    }

    const projects = this.getModuleProjects(filepath)
    if (!projects.length) {
      // if there are no modules it's possible that server was restarted
      // we don't have information about importers anymore, so let's check if the file is a test file at least
      if (this.state.filesMap.has(filepath) || this.projects.some(project => project.isTestFile(filepath))) {
        this.changedTests.add(filepath)
        return [filepath]
      }
      return []
    }

    const files: string[] = []

    for (const project of projects) {
      const mods = project.getModulesByFilepath(filepath)
      if (!mods.size) {
        continue
      }

      this.invalidates.add(filepath)

      // one of test files that we already run, or one of test files that we can run
      if (this.state.filesMap.has(filepath) || project.isTestFile(filepath)) {
        this.changedTests.add(filepath)
        files.push(filepath)
        continue
      }

      let rerun = false
      for (const mod of mods) {
        mod.importers.forEach((i) => {
          if (!i.file) {
            return
          }

          const heedsRerun = this.handleFileChanged(i.file)
          if (heedsRerun.length) {
            rerun = true
          }
        })
      }

      if (rerun) {
        files.push(filepath)
      }
    }

    return Array.from(new Set(files))
  }

  private async reportCoverage(coverage: unknown, allTestsRun: boolean) {
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

  async close() {
    if (!this.closingPromise) {
      this.closingPromise = (async () => {
        const teardownProjects = [...this.projects]
        if (!teardownProjects.includes(this.coreWorkspaceProject)) {
          teardownProjects.push(this.coreWorkspaceProject)
        }
        // do teardown before closing the server
        for (const project of teardownProjects.reverse()) {
          await project._teardownGlobalSetup()
        }

        const closePromises: unknown[] = this.resolvedProjects.map(w => w.close())
        // close the core workspace server only once
        // it's possible that it's not initialized at all because it's not running any tests
        if (!this.resolvedProjects.includes(this.coreWorkspaceProject)) {
          closePromises.push(this.coreWorkspaceProject.close().then(() => this.server = undefined as any))
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
          this.logger.logUpdate.done() // restore terminal cursor
        })
      })()
    }
    return this.closingPromise
  }

  /**
   * Close the thread pool and exit the process
   */
  async exit(force = false) {
    setTimeout(() => {
      this.report('onProcessTimeout').then(() => {
        console.warn(`close timed out after ${this.config.teardownTimeout}ms`)
        this.state.getProcessTimeoutCauses().forEach(cause => console.warn(cause))

        if (!this.pool) {
          const runningServers = [this.server, ...this.resolvedProjects.map(p => p.server)].filter(Boolean).length

          if (runningServers === 1) {
            console.warn('Tests closed successfully but something prevents Vite server from exiting')
          }
          else if (runningServers > 1) {
            console.warn(`Tests closed successfully but something prevents ${runningServers} Vite servers from exiting`)
          }
          else { console.warn('Tests closed successfully but something prevents the main process from exiting') }

          console.warn('You can try to identify the cause by enabling "hanging-process" reporter. See https://vitest.dev/config/#reporters')
        }

        process.exit()
      })
    }, this.config.teardownTimeout).unref()

    await this.close()
    if (force) {
      process.exit()
    }
  }

  async report<T extends keyof Reporter>(name: T, ...args: ArgumentsType<Reporter[T]>) {
    await Promise.all(this.reporters.map(r => r[name]?.(
      // @ts-expect-error let me go
      ...args,
    )))
  }

  public async getTestFilepaths() {
    return this.globTestSpecs().then(specs => specs.map(spec => spec.moduleId))
  }

  public async globTestSpecs(filters: string[] = []) {
    const files: TestSpecification[] = []
    const dir = process.cwd()
    const parsedFilters = filters.map(f => parseFilter(f))

    // Require includeTaskLocation when a location filter is passed
    if (
      !this.config.includeTaskLocation
      && parsedFilters.some(f => f.lineNumber !== undefined)
    ) {
      throw new IncludeTaskLocationDisabledError()
    }

    const testLocations = groupFilters(parsedFilters.map(
      f => ({ ...f, filename: slash(resolve(dir, f.filename)) }),
    ))

    // Key is file and val sepcifies whether we have matched this file with testLocation
    const testLocHasMatch: { [f: string]: boolean } = {}

    await Promise.all(this.projects.map(async (project) => {
      const { testFiles, typecheckTestFiles } = await project.globTestFiles(
        parsedFilters.map(f => f.filename),
      )

      testFiles.forEach((file) => {
        const loc = testLocations[file]
        testLocHasMatch[file] = true

        const spec = project.createSpecification(file, undefined, loc)
        this.ensureSpecCached(spec)
        files.push(spec)
      })
      typecheckTestFiles.forEach((file) => {
        const loc = testLocations[file]
        testLocHasMatch[file] = true

        const spec = project.createSpecification(file, 'typescript', loc)
        this.ensureSpecCached(spec)
        files.push(spec)
      })
    }))

    Object.entries(testLocations).forEach(([filepath, loc]) => {
      if (loc.length !== 0 && !testLocHasMatch[filepath]) {
        throw new LocationFilterFileNotFoundError(
          relative(dir, filepath),
        )
      }
    })

    return files as WorkspaceSpec[]
  }

  /**
   * @deprecated use `globTestSpecs` instead
   */
  public async globTestFiles(filters: string[] = []) {
    return this.globTestSpecs(filters)
  }

  private ensureSpecCached(spec: TestSpecification) {
    const file = spec[1]
    const specs = this._cachedSpecs.get(file) || []
    const included = specs.some(_s => _s[0] === spec[0] && _s[2].pool === spec[2].pool)
    if (!included) {
      specs.push(spec)
      this._cachedSpecs.set(file, specs)
    }
  }

  // The server needs to be running for communication
  shouldKeepServer() {
    return !!this.config?.watch
  }

  onServerRestart(fn: OnServerRestartHandler) {
    this._onRestartListeners.push(fn)
  }

  onAfterSetServer(fn: OnServerRestartHandler) {
    this._onSetServer.push(fn)
  }

  onCancel(fn: (reason: CancelReason) => void) {
    this._onCancelListeners.push(fn)
  }

  onClose(fn: () => void) {
    this._onClose.push(fn)
  }

  onTestsRerun(fn: OnTestsRerunHandler): void {
    this._onUserTestsRerun.push(fn)
  }
}
