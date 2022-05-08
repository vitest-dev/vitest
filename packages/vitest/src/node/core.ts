import { existsSync, promises as fs } from 'fs'
import readline from 'readline'
import type { ViteDevServer } from 'vite'
import { relative, toNamespacedPath } from 'pathe'
import fg from 'fast-glob'
import mm from 'micromatch'
import c from 'picocolors'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import type { ArgumentsType, Reporter, ResolvedConfig, UserConfig } from '../types'
import { SnapshotManager } from '../integrations/snapshot/manager'
import { clearTimeout, deepMerge, hasFailed, noop, setTimeout, slash, toArray } from '../utils'
import { cleanCoverage, reportCoverage } from '../integrations/coverage'
import { createPool } from './pool'
import type { WorkerPool } from './pool'
import { createReporters } from './reporters/utils'
import { StateManager } from './state'
import { resolveConfig } from './config'
import { printError } from './error'
import { VitestGit } from './git'

const WATCHER_DEBOUNCE = 100
const CLOSE_TIMEOUT = 1_000

export class Vitest {
  config: ResolvedConfig = undefined!
  configOverride: Partial<ResolvedConfig> | undefined

  server: ViteDevServer = undefined!
  state: StateManager = undefined!
  snapshot: SnapshotManager = undefined!
  reporters: Reporter[] = undefined!
  console: Console
  pool: WorkerPool | undefined

  outputStream = process.stdout
  errorStream = process.stderr

  vitenode: ViteNodeServer = undefined!

  invalidates: Set<string> = new Set()
  changedTests: Set<string> = new Set()
  runningPromise?: Promise<void>
  closingPromise?: Promise<void>

  isFirstRun = true
  restartsCount = 0
  runner: ViteNodeRunner = undefined!

  private _onRestartListeners: Array<() => void> = []

  constructor() {
    this.console = globalThis.console
  }

  async setServer(options: UserConfig, server: ViteDevServer) {
    this.unregisterWatcher?.()
    clearTimeout(this._rerunTimer)
    this.restartsCount += 1
    this.pool?.close()
    this.pool = undefined

    const resolved = resolveConfig(options, server.config)

    this.server = server
    this.config = resolved
    this.state = new StateManager()
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

    this.reporters = await createReporters(resolved.reporters, this.runner)

    this.runningPromise = undefined

    this._onRestartListeners.forEach(fn => fn())

    if (resolved.coverage.enabled)
      await cleanCoverage(resolved.coverage, resolved.coverage.clean)
  }

  getConfig() {
    const hasCustomReporter = toArray(this.config.reporters)
      .some(reporter => typeof reporter !== 'string')

    // cannot be serialized for sending to workers
    // reimplemented on rpc
    if (this.config.snapshotOptions.resolveSnapshotPath)
      this.config.snapshotOptions.resolveSnapshotPath = undefined

    if (!hasCustomReporter && !this.configOverride)
      return this.config

    const config = deepMerge({}, this.config)

    if (this.configOverride)
      deepMerge(config, this.configOverride)

    // Custom reporters cannot be serialized for sending to workers #614
    // but workers don't need reporters anyway
    if (hasCustomReporter)
      config.reporters = []

    return config as ResolvedConfig
  }

  async start(filters?: string[]) {
    await this.report('onInit', this)

    const files = await this.filterTestsBySource(
      await this.globTestFiles(filters),
    )

    if (!files.length) {
      const exitCode = this.config.passWithNoTests ? 0 : 1

      const comma = c.dim(', ')
      if (filters?.length)
        this.console.error(c.dim('filter:  ') + c.yellow(filters.join(comma)))
      if (this.config.include)
        this.console.error(c.dim('include: ') + c.yellow(this.config.include.join(comma)))
      if (this.config.watchIgnore)
        this.console.error(c.dim('ignore:  ') + c.yellow(this.config.watchIgnore.join(comma)))

      if (this.config.passWithNoTests)
        this.log('No test files found, exiting with code 0\n')
      else
        this.error(c.red('\nNo test files found, exiting with code 1'))

      process.exit(exitCode)
    }

    await this.runFiles(files)

    if (this.config.coverage.enabled)
      await reportCoverage(this)

    if (this.config.watch)
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
      const vitestGit = new VitestGit(this.config.root)
      const related = await vitestGit.findChangedFiles({
        changedSince: this.config.changed,
      })
      if (!related) {
        this.error(c.red('Could not find Git root. Have you initialized git with `git init`?\n'))
        process.exit(1)
      }
      this.config.related = Array.from(new Set(related))
    }

    const related = this.config.related
    if (!related)
      return tests

    // don't run anything if no related sources are found
    if (!related.length)
      return []

    const testDeps = await Promise.all(
      tests.map(async (filepath) => {
        const deps = await this.getTestDependencies(filepath)
        return [filepath, deps] as const
      }),
    )

    const runningTests = []

    for (const [filepath, deps] of testDeps) {
      // if deps or the test itself were changed
      if (deps.size && related.some(path => path === filepath || deps.has(path)))
        runningTests.push(filepath)
    }

    return runningTests
  }

  async runFiles(files: string[]) {
    await this.runningPromise

    this.runningPromise = (async () => {
      if (!this.pool)
        this.pool = createPool(this)

      const invalidates = Array.from(this.invalidates)
      this.invalidates.clear()
      this.snapshot.clear()
      this.state.clearErrors()
      try {
        await this.pool.runTests(files, invalidates)
      }
      catch (err) {
        this.state.catchError(err, 'Unhandled Error')
      }

      if (hasFailed(this.state.getFiles()))
        process.exitCode = 1

      await this.report('onFinished', this.state.getFiles(), this.state.getUnhandledErrors())
    })()
      .finally(() => {
        this.runningPromise = undefined
      })

    return await this.runningPromise
  }

  async rerunFiles(files: string[] = this.state.getFilepaths(), trigger?: string) {
    await this.report('onWatcherRerun', files, trigger)
    await this.runFiles(files)
    await this.report('onWatcherStart')
  }

  async changeNamePattern(pattern: string, files: string[] = this.state.getFilepaths(), trigger?: string) {
    this.config.testNamePattern = pattern ? new RegExp(pattern) : undefined
    await this.rerunFiles(files, trigger)
  }

  async returnFailed() {
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

  log(...args: any[]) {
    this.console.log(...args)
  }

  error(...args: any[]) {
    this.console.error(...args)
  }

  clearScreen() {
    if (this.server.config.clearScreen === false)
      return

    const repeatCount = process.stdout.rows - 2
    const blank = repeatCount > 0 ? '\n'.repeat(repeatCount) : ''
    this.console.log(blank)
    readline.cursorTo(process.stdout, 0, 0)
    readline.clearScreenDown(process.stdout)
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

      // add previously failed files
      // if (RERUN_FAILED) {
      //   ctx.state.getFiles().forEach((file) => {
      //     if (file.result?.state === 'fail')
      //       changedTests.add(file.filepath)
      //   })
      // }
      this.snapshot.clear()
      const files = Array.from(this.changedTests)
      this.changedTests.clear()

      if (this.config.coverage.enabled && this.config.coverage.cleanOnRerun)
        await cleanCoverage(this.config.coverage)

      await this.report('onWatcherRerun', files, triggerId)

      await this.runFiles(files)

      if (this.config.coverage.enabled)
        await reportCoverage(this)

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
        this.changedTests.delete(id)
        this.report('onTestRemoved', id)
      }
    }
    const onAdd = async (id: string) => {
      id = slash(id)
      if (await this.isTargetFile(id)) {
        this.changedTests.add(id)
        this.scheduleRerun(id)
      }
    }
    const watcher = this.server.watcher
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
    if (this.changedTests.has(id) || this.invalidates.has(id) || this.config.watchIgnore.some(i => id.match(i)))
      return false

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
      ].filter(Boolean)).then((results) => {
        results.filter(r => r.status === 'rejected').forEach((err) => {
          this.error('error during close', (err as PromiseRejectedResult).reason)
        })
      })
    }
    return this.closingPromise
  }

  async exit(force = false) {
    setTimeout(() => {
      console.warn(`close timed out after ${CLOSE_TIMEOUT}ms`)
      process.exit()
    }, CLOSE_TIMEOUT).unref()

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
    const globOptions = {
      absolute: true,
      cwd: this.config.dir || this.config.root,
      ignore: this.config.exclude,
    }

    let testFiles = await fg(this.config.include, globOptions)

    if (filters.length && process.platform === 'win32')
      filters = filters.map(f => toNamespacedPath(f))

    if (filters.length)
      testFiles = testFiles.filter(i => filters.some(f => i.includes(f)))

    if (this.config.includeSource) {
      let files = await fg(this.config.includeSource, globOptions)
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

  printError(err: unknown, fullStack = false, type?: string) {
    return printError(err, this, {
      fullStack,
      type,
      showCodeFrame: true,
    })
  }

  onServerRestarted(fn: () => void) {
    this._onRestartListeners.push(fn)
  }
}
