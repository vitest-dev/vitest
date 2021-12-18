import { resolve } from 'pathe'
import type { ViteDevServer, InlineConfig as ViteInlineConfig, UserConfig as ViteUserConfig } from 'vite'
import { createServer, mergeConfig } from 'vite'
import { findUp } from 'find-up'
import fg from 'fast-glob'
import mm from 'micromatch'
import type { ArgumentsType, Reporter, ResolvedConfig, UserConfig } from '../types'
import { SnapshotManager } from '../integrations/snapshot/manager'
import { configFiles, defaultPort } from '../constants'
import { hasFailed, noop, slash, toArray } from '../utils'
import { ConsoleReporter } from '../reporters/console'
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

  invalidates: Set<string> = new Set()
  changedTests: Set<string> = new Set()
  runningPromise?: Promise<void>
  isFirstRun = true

  restartsCount = 0

  private _onRestartListeners: Array<() => void> = []

  constructor() {
    this.console = globalThis.console
  }

  setServer(options: UserConfig, server: ViteDevServer) {
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
    this.reporters = toArray(resolved.reporters)

    if (!this.reporters.length)
      this.reporters.push(new ConsoleReporter(this))

    if (this.config.watch)
      this.registerWatcher()

    this.runningPromise = undefined

    this._onRestartListeners.forEach(fn => fn())
  }

  async start(filters?: string[]) {
    const files = await this.globTestFiles(filters)

    if (!files.length) {
      console.error('No test files found')
      process.exitCode = 1
    }

    await this.runFiles(files)

    if (this.config.watch)
      await this.report('onWatcherStart')
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
      const files = Array.from(this.changedTests)

      await this.report('onWatcherRerun', files, triggerId)

      await this.runFiles(files)

      await this.report('onWatcherStart')
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

      if (id in this.state.filesMap) {
        delete this.state.filesMap[id]
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
    if (this.changedTests.has(id) || this.invalidates.has(id) || id.includes('/node_modules/') || id.includes('/vitest/dist/'))
      return

    this.invalidates.add(id)

    if (id in this.state.filesMap) {
      this.changedTests.add(id)
      return
    }

    const mod = this.server.moduleGraph.getModuleById(id)

    if (mod) {
      mod.importers.forEach((i) => {
        if (i.id)
          this.handleFileChanged(i.id)
      })
    }
  }

  async close() {
    await this.pool?.close()
    await this.server.close()
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
    : await findUp(configFiles, { cwd: root })

  let haveStarted = false

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
          ctx.setServer(options, server)
          haveStarted = true
          if (options.api)
            server.middlewares.use((await import('../api/middleware')).default(ctx))
        },
      },
    ],
    server: {
      open: options.open,
      strictPort: true,
    },
    optimizeDeps: {
      exclude: [
        'vitest',
      ],
    },
  }

  const server = await createServer(mergeConfig(config, viteOverrides))
  await server.pluginContainer.buildStart({})

  if (options.api === true)
    options.api = defaultPort

  if (typeof options.api === 'number')
    await server.listen(options.api)

  return ctx
}
