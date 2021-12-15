import { resolve } from 'path'
import type { ViteDevServer, InlineConfig as ViteInlineConfig, UserConfig as ViteUserConfig } from 'vite'
import { mergeConfig, createServer } from 'vite'
import { findUp } from 'find-up'
import type { Reporter, UserConfig, ResolvedConfig, ArgumentsType } from '../types'
import { SnapshotManager } from '../integrations/snapshot/manager'
import { configFiles } from '../constants'
import { toArray, hasFailed } from '../utils'
import { ConsoleReporter } from '../reporters/console'
import type { WorkerPool } from './pool'
import { StateManager } from './state'
import { resolveConfig } from './config'
import { createPool } from './pool'
import { globTestFiles } from './glob'
import { startWatcher } from './watcher'

class Vitest {
  config: ResolvedConfig
  server: ViteDevServer
  state: StateManager
  snapshot: SnapshotManager
  reporters: Reporter[]
  console: Console
  pool: WorkerPool | undefined

  constructor(options: UserConfig, server: ViteDevServer) {
    const resolved = resolveConfig(options, server.config)
    this.server = server
    this.config = resolved
    this.state = new StateManager()
    this.snapshot = new SnapshotManager(resolved)
    this.reporters = toArray(resolved.reporters)
    this.console = globalThis.console

    if (!this.reporters.length)
      this.reporters.push(new ConsoleReporter(this))
  }

  async run(filters?: string[]) {
    let testFilepaths = await globTestFiles(this.config)

    if (filters?.length)
      testFilepaths = testFilepaths.filter(i => filters.some(f => i.includes(f)))

    if (!testFilepaths.length) {
      console.error('No test files found')
      process.exitCode = 1
      return
    }

    if (!this.pool)
      this.pool = createPool(this)

    await this.pool.runTests(testFilepaths)

    if (hasFailed(this.state.getFiles()))
      process.exitCode = 1

    await this.report('onFinished', this.state.getFiles())

    if (this.config.watch)
      await startWatcher(this)
    else
      await this.pool.close()
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
}

export type { Vitest }

export async function createVitest(options: UserConfig, viteOverrides?: ViteUserConfig): Promise<Vitest> {
  const server = await startServer(options, viteOverrides)
  const instance = new Vitest(options, server)

  return instance
}

async function startServer(options: UserConfig, viteOverrides: ViteUserConfig = {}) {
  const root = resolve(options.root || process.cwd())

  const configPath = options.config
    ? resolve(root, options.config)
    : await findUp(configFiles, { cwd: root })

  const config: ViteInlineConfig = {
    root,
    logLevel: 'error',
    clearScreen: false,
    configFile: configPath,
    plugins: [
      {
        name: 'vitest',
        async configureServer(server) {
          if (options.api)
            server.middlewares.use((await import('../api/middleware')).default())
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

  if (typeof options.api === 'number')
    await server.listen(options.api)

  return server
}
