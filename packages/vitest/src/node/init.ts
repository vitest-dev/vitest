import { resolve } from 'path'
import { findUp } from 'find-up'
import type { ResolvedConfig as ResolvedViteConfig } from 'vite'
import { createServer } from 'vite'
import type { CliOptions, ResolvedConfig } from '../types'
import { configFiles, defaultExcludes, defaultIncludes, defaultPort } from '../constants'
import type { VitestContext } from '../../dist'
import { SnapshotManager } from '../integrations/snapshot/manager'
import { ConsoleReporter } from '../reporters/console'
import { toArray } from '../utils'
import { StateManager } from './state'
// import { VitestUIPlugin } from '../../packages/ui/node'

/**
 * Initalized Vite server and resolving configs and fill the defaults
 * They are together because we have configs in Vite config
 * that need to be merged after server starts.
 */
export async function initVitest(options: CliOptions = {}) {
  const root = resolve(options.root || process.cwd())
  process.chdir(root)

  if (options.dom)
    options.environment = 'happy-dom'

  const configPath = options.config
    ? resolve(root, options.config)
    : await findUp(configFiles, { cwd: root })

  const resolved = { ...options } as ResolvedConfig

  resolved.config = configPath
  resolved.root = root

  const server = await createServer({
    root,
    logLevel: 'error',
    clearScreen: false,
    configFile: resolved.config,
    plugins: [
      {
        name: 'vitest',
        configResolved(viteConfig) {
          resolveConfig(resolved, viteConfig)
        },
        async configureServer(server) {
          if (resolved.api)
            server.middlewares.use((await import('../api/middleware')).default())
        },
      },
      // TODO: UI
      // ...(options.open ? [VitestUIPlugin()] : []),
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
  })
  await server.pluginContainer.buildStart({})

  if (typeof resolved.api === 'number')
    await server.listen(resolved.api)

  const ctx: VitestContext = {
    server,
    config: resolved,
    state: new StateManager(),
    snapshot: new SnapshotManager(resolved),
    reporters: toArray(resolved.reporters),
    console: globalThis.console,
  }

  if (!ctx.reporters.length)
    ctx.reporters.push(new ConsoleReporter(ctx))

  return ctx
}

function resolveConfig(
  resolved: ResolvedConfig,
  viteConfig: ResolvedViteConfig,
) {
  Object.assign(resolved, viteConfig.test)

  resolved.depsInline = resolved.deps?.inline || []
  resolved.depsExternal = resolved.deps?.external || []

  resolved.environment = resolved.environment || 'node'
  resolved.threads = resolved.threads ?? true
  resolved.interpretDefault = resolved.interpretDefault ?? true

  resolved.includes = resolved.includes ?? defaultIncludes
  resolved.excludes = resolved.excludes ?? defaultExcludes

  const CI = !!process.env.CI
  const UPDATE_SNAPSHOT = resolved.update || process.env.UPDATE_SNAPSHOT
  resolved.snapshotOptions = {
    updateSnapshot: CI && !UPDATE_SNAPSHOT
      ? 'none'
      : UPDATE_SNAPSHOT
        ? 'all'
        : 'new',
  }

  if (process.env.VITEST_MAX_THREADS)
    resolved.maxThreads = parseInt(process.env.VITEST_MAX_THREADS)

  if (process.env.VITEST_MIN_THREADS)
    resolved.minThreads = parseInt(process.env.VITEST_MIN_THREADS)

  resolved.setupFiles = Array.from(resolved.setupFiles || [])
    .map(i => resolve(resolved.root, i))

  if (resolved.api === true)
    resolved.api = defaultPort
}
