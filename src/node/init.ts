import { resolve } from 'path'
import { findUp } from 'find-up'
import { createServer } from 'vite'
import type { CliOptions, ResolvedConfig } from '../types'
import { defaultExcludes, defaultIncludes } from '../constants'
import { toArray } from '../utils'

const configFiles = [
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mjs',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
]

/**
 * Initalized Vite server and resolving configs and fill the defaults
 * They are together because we have configs in Vite config
 * that need to be merged after server starts.
 */
export async function initViteServer(options: CliOptions = {}) {
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
  if (options.cliFilters)
    resolved.cliFilters = toArray(options.cliFilters)

  const server = await createServer({
    root,
    logLevel: 'error',
    clearScreen: false,
    configFile: resolved.config,
    optimizeDeps: {
      exclude: [
        'vitest',
      ],
    },
  })
  await server.pluginContainer.buildStart({})

  Object.assign(resolved, server.config.test)

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

  return {
    server,
    config: resolved,
  }
}
