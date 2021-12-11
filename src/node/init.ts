import { resolve } from 'path'
import { findUp } from 'find-up'
import { createServer } from 'vite'
import { SnapshotStateOptions } from 'jest-snapshot/build/State'
import { toArray } from '@antfu/utils'
import { CliOptions, ResolvedConfig } from '../types'

const configFiles = [
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mjs',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
]

export async function initViteServer(options: CliOptions = {}) {
  const root = resolve(options.root || process.cwd())
  process.chdir(root)

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

  resolved.depsInline = server.config.test?.deps?.inline || []
  resolved.depsExternal = server.config.test?.deps?.external || []

  const env = process.env
  const CI = !!env.CI
  const UPDATE_SNAPSHOT = resolved.update || env.UPDATE_SNAPSHOT

  resolved.snapshotOptions = {
    updateSnapshot: CI && !UPDATE_SNAPSHOT
      ? 'none'
      : UPDATE_SNAPSHOT
        ? 'all'
        : 'new',
  } as SnapshotStateOptions

  return {
    server,
    config: resolved,
  }
}
