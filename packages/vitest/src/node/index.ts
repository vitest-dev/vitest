import { existsSync } from 'fs'
import { resolve } from 'pathe'
import type { ViteDevServer, InlineConfig as ViteInlineConfig, Plugin as VitePlugin, UserConfig as ViteUserConfig } from 'vite'
import { createServer, mergeConfig } from 'vite'
import { findUp } from 'find-up'
import fg from 'fast-glob'
import mm from 'micromatch'
import c from 'picocolors'
import type { RawSourceMap } from 'source-map-js'
import type { ArgumentsType, Reporter, ResolvedConfig, UserConfig } from '../types'
import { SnapshotManager } from '../integrations/snapshot/manager'
import { configFiles, defaultPort } from '../constants'
import { ensurePackageInstalled, hasFailed, noop, slash, toArray } from '../utils'
import { MocksPlugin } from '../plugins/mock'
import { DefaultReporter } from '../reporters/default'
import { ReportersMap } from '../reporters'
import { cleanCoverage, reportCoverage } from '../coverage'
import type { WorkerPool } from './pool'
import { StateManager } from './state'
import { resolveConfig } from './config'
import { createPool } from './pool'

const WATCHER_DEBOUNCE = 100

class Vitest {
  config: ResolvedConfig = undefined!
  server: ViteDevServer = undefined!
  state: StateManager = undefined!
  snapshot: SnapshotManager = undefined!
  reporters: Reporter[] = undefined!
  console: Console
  pool: WorkerPool | undefined

  outputStream = process.stdout
  errorStream = process.stderr

  invalidates: Set<string> = new Set()
  changedTests: Set<string> = new Set()
  visitedFilesMap: Map<string, RawSourceMap> = new Map()
  runningPromise?: Promise<void>
  closingPromise?: Promise<void>

  isFirstRun = true

  restartsCount = 0

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
    this.snapshot = new SnapshotManager(resolved)
    // @ts-expect-error cli type
    this.reporters = toArray(resolved.reporters || resolved.reporter)
      .map((i) => {
        if (typeof i === 'string') {
          const Reporter = ReportersMap[i]
          if (!Reporter)
            throw new Error(`Unknown reporter: ${i}`)
          return new Reporter()
        }
        return i
      })

    if (!this.reporters.length)
      this.reporters.push(new DefaultReporter())

    if (this.config.watch)
      this.registerWatcher()

    this.runningPromise = undefined

    this._onRestartListeners.forEach(fn => fn())

    if (resolved.coverage.enabled)
      await cleanCoverage(resolved.coverage, resolved.coverage.clean)
  }

  async start(filters?: string[]) {
    this.report('onInit', this)

    const files = await this.filterTestsBySource(
      await this.globTestFiles(filters),
    )

    if (!files.length) {
      if (this.config.passWithNoTests)
        this.log('No test files found\n')
      else
        this.error(c.red('No test files found\n'))
      process.exit(this.config.passWithNoTests ? 0 : 1)
    }

    await this.runFiles(files)

    if (this.config.watch)
      await this.report('onWatcherStart')

    if (this.config.coverage.enabled)
      await reportCoverage(this)
  }

  private async getTestDependencies(filepath: string) {
    const deps = new Set<string>()

    const addImports = async(filepath: string) => {
      const transformed = await this.server.transformRequest(filepath, { ssr: true })
      if (!transformed) return
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
    const related = this.config.related
    if (!related)
      return tests

    // dont run anything if no related sources are found
    if (!related.length)
      return []

    const testDeps = await Promise.all(
      tests.map(async(filepath) => {
        const deps = await this.getTestDependencies(filepath)
        return [filepath, deps] as const
      }),
    )

    const runningTests = []

    for (const [filepath, deps] of testDeps) {
      if (deps.size && related.some(path => deps.has(path)))
        runningTests.push(filepath)
    }

    return runningTests
  }

  async runFiles(files: string[]) {
    await this.runningPromise

    this.runningPromise = (async() => {
      if (!this.pool)
        this.pool = createPool(this)

      const invalidates = Array.from(this.invalidates)
      this.invalidates.clear()
      await this.pool.runTests(files, invalidates)

      if (hasFailed(this.state.getFiles()))
        process.exitCode = 1

      await this.report('onFinished', this.state.getFiles())
    })()
      .finally(() => {
        this.runningPromise = undefined
      })

    return await this.runningPromise
  }

  log(...args: any[]) {
    this.console.log(...args)
  }

  error(...args: any[]) {
    this.console.error(...args)
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

    this._rerunTimer = setTimeout(async() => {
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

      this.log('return')
      if (this.config.coverage.enabled && this.config.coverage.cleanOnRerun)
        await cleanCoverage(this.config.coverage)

      await this.report('onWatcherRerun', files, triggerId)

      await this.runFiles(files)

      await this.report('onWatcherStart')

      if (this.config.coverage.enabled)
        await reportCoverage(this)
    }, WATCHER_DEBOUNCE)
  }

  private unregisterWatcher = noop
  private registerWatcher() {
    const onChange = (id: string) => {
      id = slash(id)
      this.handleFileChanged(id)
      if (this.changedTests.size)
        this.scheduleRerun(id)
    }
    const onUnlink = (id: string) => {
      id = slash(id)
      this.invalidates.add(id)

      if (this.state.filesMap.has(id)) {
        this.state.filesMap.delete(id)
        this.changedTests.delete(id)
      }
    }
    const onAdd = (id: string) => {
      id = slash(id)
      if (this.isTargetFile(id)) {
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

  private handleFileChanged(id: string) {
    if (this.changedTests.has(id) || this.invalidates.has(id) || this.config.watchIgnore.some(i => id.match(i)))
      return

    const mod = this.server.moduleGraph.getModuleById(id)
    if (!mod)
      return

    this.invalidates.add(id)

    if (this.state.filesMap.has(id)) {
      this.changedTests.add(id)
      return
    }

    mod.importers.forEach((i) => {
      if (i.id)
        this.handleFileChanged(i.id)
    })
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

  async report<T extends keyof Reporter>(name: T, ...args: ArgumentsType<Reporter[T]>) {
    await Promise.all(this.reporters.map(r => r[name]?.(
      // @ts-expect-error
      ...args,
    )))
  }

  async globTestFiles(filters?: string[]) {
    let files = await fg(
      this.config.include,
      {
        absolute: true,
        cwd: this.config.root,
        ignore: this.config.exclude,
      },
    )

    if (filters?.length)
      files = files.filter(i => filters.some(f => i.includes(f)))

    return files
  }

  isTargetFile(id: string): boolean {
    if (mm.isMatch(id, this.config.exclude))
      return false
    return mm.isMatch(id, this.config.include)
  }

  onServerRestarted(fn: () => void) {
    this._onRestartListeners.push(fn)
  }
}

export type { Vitest }

export async function createVitest(options: UserConfig, viteOverrides: ViteUserConfig = {}) {
  const ctx = new Vitest()

  const root = resolve(options.root || process.cwd())

  const configPath = options.config
    ? resolve(root, options.config)
    : await findUp(configFiles, { cwd: root } as any)

  let haveStarted = false

  async function UIPlugin() {
    if (!options.open)
      return

    await ensurePackageInstalled('@vitest/ui')
    return (await import('@vitest/ui')).default()
  }

  const config: ViteInlineConfig = {
    root,
    logLevel: 'error',
    clearScreen: false,
    configFile: configPath,
    plugins: [
      {
        name: 'vitest',
        async configureServer(server) {
          if (haveStarted)
            await ctx.report('onServerRestart')
          await ctx.setServer(options, server)
          haveStarted = true
          if (options.api)
            (await import('../api/setup')).setup(ctx)
        },
      } as VitePlugin,
      MocksPlugin(),
      await UIPlugin(),
    ],
    server: {
      hmr: false,
      open: options.open ? '/__vitest__/' : undefined,
      strictPort: true,
      preTransformRequests: false,
    },
    build: {
      sourcemap: true,
    },
  }

  const server = await createServer(mergeConfig(config, viteOverrides))
  await server.pluginContainer.buildStart({})

  if (options.api === true)
    options.api = defaultPort
  if (options.open && typeof options.api !== 'number')
    options.api = defaultPort
  if (typeof options.api === 'number')
    await server.listen(options.api)

  return ctx
}
