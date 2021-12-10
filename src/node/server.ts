import { resolve } from 'path'
import { findUp } from 'find-up'
import { createServer } from 'vite'
import { SnapshotStateOptions } from 'jest-snapshot/build/State'
import { ResolvedConfig, UserOptions } from '../types'

const configFiles = [
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mjs',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
]

export async function initViteServer(options: UserOptions = {}) {
  const { filters } = options

  const root = resolve(options.root || process.cwd())
  process.chdir(root)

  const configPath = options.config
    ? resolve(root, options.config)
    : await findUp(configFiles, { cwd: root })

  const resolved = { ...options } as ResolvedConfig

  resolved.config = configPath
  resolved.root = root
  resolved.filters = filters
    ? Array.isArray(filters)
      ? filters
      : [filters]
    : undefined

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

  resolved.depsInline = [
    'vitest/dist',
    'vitest/src',
    '@vue',
    '@vueuse',
    'vue-demi',
    'vue',
    /virtual:/,
    /\.ts$/,
    /\/esm\/.*\.js$/,
    /\.(es|esm|esm-browser|esm-bundler|es6).js$/,
    ...server.config.test?.deps?.inline || [],
  ]
  resolved.depsExternal = [
    /node_modules/,
    ...server.config.test?.deps?.external || [],
  ]

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
