import { existsSync, promises as fs } from 'node:fs'
import type { ViteDevServer } from 'vite'
import { mergeConfig } from 'vite'
import { basename, dirname, join, normalize, relative } from 'pathe'
import fg from 'fast-glob'
import mm from 'micromatch'
import c from 'picocolors'
import { normalizeRequestId } from 'vite-node/utils'
import { ViteNodeRunner } from 'vite-node/client'
import { SnapshotManager } from '@vitest/snapshot/manager'
import type { ArgumentsType, CoverageProvider, OnServerRestartHandler, Reporter, ResolvedConfig, UserConfig, UserWorkspaceConfig, VitestRunMode } from '../types'
import { hasFailed, noop, slash, toArray } from '../utils'
import { getCoverageProvider } from '../integrations/coverage'
import type { BrowserProvider } from '../types/browser'
import { CONFIG_NAMES, configFiles, workspacesFiles } from '../constants'
import { createPool } from './pool'
import type { ProcessPool, WorkspaceSpec } from './pool'
import { createBenchmarkReporters, createReporters } from './reporters/utils'
import { StateManager } from './state'
import { resolveConfig } from './config'
import { Logger } from './logger'
import { VitestCache } from './cache'
import { VitestWorkspace, initializeWorkspace } from './workspace'
import { VitestServer } from './server'

const WATCHER_DEBOUNCE = 100

export class Vitest {
  config: ResolvedConfig = undefined!
  configOverride: Partial<ResolvedConfig> = {}

  server: ViteDevServer = undefined!
  state: StateManager = undefined!
  snapshot: SnapshotManager = undefined!
  cache: VitestCache = undefined!
  reporters: Reporter[] = undefined!
  coverageProvider: CoverageProvider | null | undefined
  browserProvider: BrowserProvider | undefined
  logger: Logger
  pool: ProcessPool | undefined

  vitenode: VitestServer = undefined!

  invalidates: Set<string> = new Set()
  changedTests: Set<string> = new Set()
  filenamePattern?: string
  runningPromise?: Promise<void>
  closingPromise?: Promise<void>

  isFirstRun = true
  restartsCount = 0
  runner: ViteNodeRunner = undefined!

  private coreWorkspace!: VitestWorkspace

  public workspaces: VitestWorkspace[] = []
  private workspacesTestFiles = new Map<string, Set<VitestWorkspace>>()

  constructor(
    public readonly mode: VitestRunMode,
  ) {
    this.logger = new Logger(this)
  }

  private _onRestartListeners: OnServerRestartHandler[] = []
  private _onSetServer: OnServerRestartHandler[] = []

  async setServer(options: UserConfig, server: ViteDevServer, cliOptions: UserConfig) {
    this.unregisterWatcher?.()
    clearTimeout(this._rerunTimer)
    this.restartsCount += 1
    this.pool?.close()
    this.pool = undefined
    this.coverageProvider = undefined
    this.runningPromise = undefined

    const resolved = resolveConfig(this.mode, options, server.config)

    this.server = server
    this.config = resolved
    this.state = new StateManager()
    this.cache = new VitestCache()
    this.snapshot = new SnapshotManager({ ...resolved.snapshotOptions })

    if (this.config.watch && this.mode !== 'typecheck')
      this.registerWatcher()

    this.vitenode = new VitestServer(server, this.config)
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
        file = normalize(file)
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

    this.cache.results.setConfig(resolved.root, resolved.cache)
    try {
      await this.cache.results.readFromCache()
    }
    catch { }

    await Promise.all(this._onSetServer.map(fn => fn()))

    this.workspaces = await this.resolveWorkspaces(options, cliOptions)

    if (this.config.testNamePattern)
      this.configOverride.testNamePattern = this.config.testNamePattern
  }

  private async createCoreWorkspace(options: UserConfig) {
    const coreWorkspace = new VitestWorkspace(this.config.root, this)
    await coreWorkspace.setServer(options, this.server, {
      runner: this.runner,
      server: this.vitenode,
    })
    this.coreWorkspace = coreWorkspace
    return coreWorkspace
  }

  public getCoreWorkspace() {
    if (!this.coreWorkspace)
      throw new Error('Core workspace not initialized')
    return this.coreWorkspace
  }

  private async resolveWorkspaces(options: UserConfig, cliOptions: UserConfig) {
    const configDir = dirname(this.server.config.configFile || this.config.root)
    const rootFiles = await fs.readdir(configDir)
    const workspacesConfigName = workspacesFiles.find((configFile) => {
      return rootFiles.includes(configFile)
    })

    if (!workspacesConfigName)
      return [await this.createCoreWorkspace(options)]

    const workspacesConfigPath = join(configDir, workspacesConfigName)

    const workspacesModule = await this.runner.executeFile(workspacesConfigPath) as {
      default: (string | UserWorkspaceConfig)[]
    }

    if (!workspacesModule.default || !Array.isArray(workspacesModule.default))
      throw new Error(`Workspaces config file ${workspacesConfigPath} must export a default array of workspace paths`)

    const workspacesGlobMatches: string[] = []
    const workspacesOptions: UserWorkspaceConfig[] = []

    for (const workspace of workspacesModule.default) {
      if (typeof workspace === 'string')
        workspacesGlobMatches.push(workspace.replace('<rootDir>', this.config.root))
      else
        workspacesOptions.push(workspace)
    }

    const globOptions: fg.Options = {
      absolute: true,
      dot: true,
      onlyFiles: false,
      markDirectories: true,
      cwd: this.config.root,
      ignore: ['**/node_modules/**'],
    }

    const workspacesFs = await fg(workspacesGlobMatches, globOptions)
    const resolvedWorkspacesPaths = await Promise.all(workspacesFs.filter((file) => {
      if (file.endsWith('/')) {
        // if it's a directory, check that we don't already have a workspace with a config inside
        const hasWorkspaceWithConfig = workspacesFs.some((file2) => {
          return file2 !== file && `${dirname(file2)}/` === file
        })
        return !hasWorkspaceWithConfig
      }
      const filename = basename(file)
      return CONFIG_NAMES.some(configName => filename.startsWith(configName))
    }).map(async (filepath) => {
      if (filepath.endsWith('/')) {
        const filesInside = await fs.readdir(filepath)
        const configFile = configFiles.find(config => filesInside.includes(config))
        return configFile || filepath
      }
      return filepath
    }))

    const overridesOptions = [
      'environment',
      'logHeapUsage',
      'allowOnly',
      'sequence',
      'testTimeout',
      'threads',
      'singleThread',
      'isolate',
      'browser',
      'mode',
    ] as const

    const cliOverrides = overridesOptions.reduce((acc, name) => {
      if (name in cliOptions)
        acc[name] = cliOptions[name] as any
      return acc
    }, {} as UserConfig)

    const workspaces = resolvedWorkspacesPaths.map(async (workspacePath) => {
      // don't start a new server, but reuse existing one
      if (
        this.server.config.configFile === workspacePath
      )
        return this.createCoreWorkspace(options)
      return initializeWorkspace(workspacePath, this, { test: cliOverrides })
    })

    workspacesOptions.forEach((options, index) => {
      workspaces.push(initializeWorkspace(index, this, mergeConfig(options, { test: cliOverrides })))
    })

    if (!workspaces.length)
      return [await this.createCoreWorkspace(options)]

    const resolvedWorkspaces = await Promise.all(workspaces)
    const names = new Set<string>()

    for (const workspace of resolvedWorkspaces) {
      const name = workspace.getName()
      if (names.has(name))
        throw new Error(`Workspace name "${name}" is not unique. All workspaces should have unique names.`)
      names.add(name)
    }

    return resolvedWorkspaces
  }

  private async initCoverageProvider() {
    if (this.coverageProvider !== undefined)
      return
    this.coverageProvider = await getCoverageProvider(this.config.coverage, this.runner)
    if (this.coverageProvider) {
      await this.coverageProvider.initialize(this)
      this.config.coverage = this.coverageProvider.resolveOptions()
    }
    return this.coverageProvider
  }

  private async initBrowserProviders() {
    return Promise.all(this.workspaces.map(w => w.initBrowserProvider()))
  }

  typecheck(filters?: string[]) {
    return Promise.all(this.workspaces.map(workspace => workspace.typecheck(filters)))
  }

  async start(filters?: string[]) {
    if (this.mode === 'typecheck') {
      await this.typecheck(filters)
      return
    }

    try {
      await this.initCoverageProvider()
      await this.coverageProvider?.clean(this.config.coverage.clean)
      await this.initBrowserProviders()
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

      await this.reportCoverage(true)
      this.logger.printNoTestFound(filters)

      process.exit(exitCode)
    }

    // populate once, update cache on watch
    await this.cache.stats.populateStats(this.config.root, files)

    await this.runFiles(files)

    await this.reportCoverage(true)

    if (this.config.watch)
      await this.report('onWatcherStart')
  }

  private async getTestDependencies(filepath: WorkspaceSpec) {
    const deps = new Set<string>()

    const addImports = async ([workspace, filepath]: WorkspaceSpec) => {
      const transformed = await workspace.vitenode.transformRequest(filepath)
      if (!transformed)
        return
      const dependencies = [...transformed.deps || [], ...transformed.dynamicDeps || []]
      for (const dep of dependencies) {
        const path = await this.server.pluginContainer.resolveId(dep, filepath, { ssr: true })
        const fsPath = path && !path.external && path.id.split('?')[0]
        if (fsPath && !fsPath.includes('node_modules') && !deps.has(fsPath) && existsSync(fsPath)) {
          deps.add(fsPath)

          await addImports([workspace, fsPath])
        }
      }
    }

    await addImports(filepath)

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
        this.logger.error(c.red('Could not find Git root. Have you initialized git with `git init`?\n'))
        process.exit(1)
      }
      this.config.related = Array.from(new Set(related))
    }

    const related = this.config.related
    if (!related)
      return specs

    const forceRerunTriggers = this.config.forceRerunTriggers
    if (forceRerunTriggers.length && mm(related, forceRerunTriggers).length)
      return specs

    // don't run anything if no related sources are found
    if (!related.length)
      return []

    const testGraphs = await Promise.all(
      specs.map(async (spec) => {
        const deps = await this.getTestDependencies(spec)
        return [spec, deps] as const
      }),
    )

    const runningTests = []

    for (const [filepath, deps] of testGraphs) {
      // if deps or the test itself were changed
      if (related.some(path => path === filepath[1] || deps.has(path)))
        runningTests.push(filepath)
    }

    return runningTests
  }

  getWorkspacesByTestFile(file: string) {
    const workspaces = this.workspacesTestFiles.get(file)
    if (!workspaces)
      return []
    return Array.from(workspaces).map(workspace => [workspace, file] as WorkspaceSpec)
  }

  async runFiles(paths: WorkspaceSpec[]) {
    const filepaths = paths.map(([, file]) => file)

    this.state.collectPaths(filepaths)

    await this.report('onPathsCollected', filepaths)

    // previous run
    await this.runningPromise

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

      this.cache.results.updateResults(files)
      await this.cache.results.writeToCache()
    })()
      .finally(async () => {
        // can be duplicate files if different workspaces are using the same file
        const specs = Array.from(new Set(paths.map(([, p]) => p)))
        await this.report('onFinished', this.state.getFiles(specs), this.state.getUnhandledErrors())
        this.runningPromise = undefined
      })

    return await this.runningPromise
  }

  async rerunFiles(files: string[] = this.state.getFilepaths(), trigger?: string) {
    if (this.filenamePattern) {
      const filteredFiles = await this.globTestFiles([this.filenamePattern])
      files = files.filter(file => filteredFiles.some(f => f[1] === file))
    }

    if (this.coverageProvider && this.config.coverage.cleanOnRerun)
      await this.coverageProvider.clean()

    await this.report('onWatcherRerun', files, trigger)
    await this.runFiles(files.flatMap(file => this.getWorkspacesByTestFile(file)))

    await this.reportCoverage(!trigger)

    await this.report('onWatcherStart', this.state.getFiles(files))
  }

  async changeNamePattern(pattern: string, files: string[] = this.state.getFilepaths(), trigger?: string) {
    // Empty test name pattern should reset filename pattern as well
    if (pattern === '')
      this.filenamePattern = undefined

    this.configOverride.testNamePattern = pattern ? new RegExp(pattern) : undefined
    await this.rerunFiles(files, trigger)
  }

  async changeFilenamePattern(pattern: string) {
    this.filenamePattern = pattern

    const files = this.state.getFilepaths()
    const trigger = this.filenamePattern ? 'change filename pattern' : 'reset filename pattern'

    await this.rerunFiles(files, trigger)
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

    this.configOverride.snapshotOptions = {
      updateSnapshot: 'all',
      // environment is resolved inside a worker thread
      snapshotEnvironment: null as any,
    }

    try {
      await this.rerunFiles(files, 'update snapshot')
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
      let files = Array.from(this.changedTests)

      if (this.filenamePattern) {
        const filteredFiles = await this.globTestFiles([this.filenamePattern])
        files = files.filter(file => filteredFiles.some(f => f[1] === file))

        // A file that does not match the current filename pattern was changed
        if (files.length === 0)
          return
      }

      this.changedTests.clear()

      if (this.coverageProvider && this.config.coverage.cleanOnRerun)
        await this.coverageProvider.clean()

      const triggerIds = new Set(triggerId.map(id => relative(this.config.root, id)))
      const triggerLabel = Array.from(triggerIds).join(', ')
      await this.report('onWatcherRerun', files, triggerLabel)

      await this.runFiles(files.flatMap(file => this.getWorkspacesByTestFile(file)))

      await this.reportCoverage(false)

      await this.report('onWatcherStart', this.state.getFiles(files))
    }, WATCHER_DEBOUNCE)
  }

  public getModuleWorkspaces(id: string) {
    return this.workspaces.filter((workspace) => {
      return workspace.server.moduleGraph.getModuleById(id)
        || workspace.browser?.moduleGraph.getModuleById(id)
        || workspace.browser?.moduleGraph.getModulesByFile(id)?.size
    })
  }

  private unregisterWatcher = noop
  private registerWatcher() {
    const updateLastChanged = (id: string) => {
      const workspaces = this.getModuleWorkspaces(id)
      workspaces.forEach(({ server, browser }) => {
        const mod = server.moduleGraph.getModuleById(id) || browser?.moduleGraph.getModuleById(id)
        if (mod)
          server.moduleGraph.invalidateModule(mod)
      })
    }

    const onChange = (id: string) => {
      id = slash(id)
      updateLastChanged(id)
      const needsRerun = this.handleFileChanged(id)
      if (needsRerun.length)
        this.scheduleRerun(needsRerun)
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
      updateLastChanged(id)
      if (await this.isTargetFile(id)) {
        this.changedTests.add(id)
        this.scheduleRerun([id])
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
  private handleFileChanged(id: string): string[] {
    if (this.changedTests.has(id) || this.invalidates.has(id))
      return []

    if (mm.isMatch(id, this.config.forceRerunTriggers)) {
      this.state.getFilepaths().forEach(file => this.changedTests.add(file))
      return []
    }

    const workspaces = this.getModuleWorkspaces(id)
    if (!workspaces.length)
      return []

    const files: string[] = []

    for (const { server, browser } of workspaces) {
      const mod = server.moduleGraph.getModuleById(id) || browser?.moduleGraph.getModuleById(id)
      if (!mod) {
        // files with `?v=` query from the browser
        const mods = browser?.moduleGraph.getModulesByFile(id)
        if (!mods?.size)
          return []
        let rerun = false
        mods.forEach((m) => {
          if (m.id && this.handleFileChanged(m.id))
            rerun = true
        })
        if (rerun)
          files.push(id)
        continue
      }

      // remove queries from id
      id = normalizeRequestId(id, server.config.base)

      this.invalidates.add(id)

      if (this.state.filesMap.has(id)) {
        this.changedTests.add(id)
        files.push(id)
        continue
      }

      let rerun = false
      mod.importers.forEach((i) => {
        if (!i.id)
          return

        const heedsRerun = this.handleFileChanged(i.id)
        if (heedsRerun)
          rerun = true
      })

      if (rerun)
        files.push(id)
    }

    return files
  }

  private async reportCoverage(allTestsRun: boolean) {
    if (this.coverageProvider) {
      this.logger.log(c.blue(' % ') + c.dim('Coverage report from ') + c.yellow(this.coverageProvider.name))
      await this.coverageProvider.reportCoverage({ allTestsRun })
    }
  }

  async close() {
    if (!this.closingPromise) {
      this.closingPromise = Promise.allSettled([
        this.pool?.close(),
        this.server.close(),
        ...this.workspaces.map(w => w.close()),
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
      this.report('onProcessTimeout').then(() => {
        console.warn(`close timed out after ${this.config.teardownTimeout}ms`)
        this.state.getProcessTimeoutCauses().forEach(cause => console.warn(cause))
        process.exit()
      })
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

  public async globTestFiles(filters: string[] = []) {
    const files: WorkspaceSpec[] = []
    await Promise.all(this.workspaces.map(async (workspace) => {
      const specs = await workspace.globTestFiles(filters)
      specs.forEach((file) => {
        files.push([workspace, file])
        const workspaces = this.workspacesTestFiles.get(file) || new Set()
        workspaces.add(workspace)
        this.workspacesTestFiles.set(file, workspaces)
      })
    }))
    return files
  }

  private async isTargetFile(id: string, source?: string): Promise<boolean> {
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

  // The server needs to be running for communication
  shouldKeepServer() {
    return !!this.config?.watch
  }

  isInSourceTestFile(code: string) {
    return code.includes('import.meta.vitest')
  }

  onServerRestart(fn: OnServerRestartHandler) {
    this._onRestartListeners.push(fn)
  }

  onAfterSetServer(fn: OnServerRestartHandler) {
    this._onSetServer.push(fn)
  }
}
