import { resolve } from 'path'
import { findUp } from 'find-up'
import { createServer } from 'vite'
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
    'diff',
    'vue-demi',
    'vue',
    ...server.config.test?.deps?.inline || [],
  ]
  resolved.depsExternal = server.config.test?.deps?.external || []

  return {
    server,
    config: resolved,
  }
}
