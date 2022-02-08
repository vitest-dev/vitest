import { resolve } from 'pathe'
import type { ResolvedConfig as ResolvedViteConfig } from 'vite'

import type { ApiConfig, ResolvedConfig, UserConfig } from '../types'
import { defaultConfig, defaultPort } from '../constants'
import { resolveC8Options } from '../integrations/coverage'
import { toArray } from '../utils'

export function resolveApiConfig<Options extends ApiConfig & UserConfig>(
  options: Options,
): ApiConfig | undefined {
  let api: ApiConfig | undefined

  if (options.ui && !options.api)
    api = { port: defaultPort }
  else if (options.api === true)
    api = { port: defaultPort }
  else if (typeof options.api === 'number')
    api = { port: options.api }

  if (typeof options.api === 'object') {
    if (api) {
      if (options.api.port)
        api.port = options.api.port
      if (options.api.strictPort)
        api.strictPort = options.api.strictPort
      if (options.api.host)
        api.host = options.api.host
    }
    else {
      api = { ...options.api }
    }
  }

  if (api) {
    if (!api.port)
      api.port = defaultPort
  }

  return api
}

export function resolveConfig(
  options: UserConfig,
  viteConfig: ResolvedViteConfig,
): ResolvedConfig {
  if (options.dom)
    options.environment = 'happy-dom'

  const globals = options?.global ?? options.globals

  const resolved = {
    ...defaultConfig,
    ...options,
    root: viteConfig.root,
    globals,
    global: globals,
  } as ResolvedConfig

  if (viteConfig.base !== '/')
    resolved.base = viteConfig.base

  resolved.coverage = resolveC8Options(options.coverage || {}, resolved.root)

  resolved.deps = resolved.deps || {}

  resolved.testNamePattern = resolved.testNamePattern
    ? resolved.testNamePattern instanceof RegExp
      ? resolved.testNamePattern
      : new RegExp(resolved.testNamePattern)
    : undefined

  const CI = !!process.env.CI
  const UPDATE_SNAPSHOT = resolved.update || process.env.UPDATE_SNAPSHOT
  resolved.snapshotOptions = {
    snapshotFormat: resolved.snapshotFormat || {},
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

  resolved.setupFiles = toArray(resolved.setupFiles || []).map(file => resolve(resolved.root, file))

  // the server has been created, we don't need to override vite.server options
  resolved.api = resolveApiConfig(options)

  if (options.related)
    resolved.related = toArray(options.related).map(file => resolve(resolved.root, file))

  return resolved
}
