import { resolve } from 'pathe'
import type { ResolvedConfig as ResolvedViteConfig } from 'vite'
import type { ResolvedConfig, UserConfig } from '../types'
import { defaultExclude, defaultInclude, defaultPort } from '../constants'

export function resolveConfig(
  options: UserConfig,
  viteConfig: ResolvedViteConfig,
): ResolvedConfig {
  if (options.dom)
    options.environment = 'happy-dom'

  const resolved = {
    ...options,
    ...viteConfig.test,
    root: viteConfig.root,
  } as ResolvedConfig

  resolved.depsInline = [...resolved.deps?.inline || []]
  resolved.depsExternal = [...resolved.deps?.external || []]

  resolved.environment = resolved.environment || 'node'
  resolved.threads = resolved.threads ?? true
  resolved.interpretDefault = resolved.interpretDefault ?? true

  resolved.include = resolved.include ?? defaultInclude
  resolved.exclude = resolved.exclude ?? defaultExclude

  resolved.testTimeout = resolved.testTimeout ?? 5_000
  resolved.hookTimeout = resolved.hookTimeout ?? 10_000

  resolved.watchIgnore = resolved.watchIgnore ?? [/\/node_modules\//, /\/dist\//]

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

  return resolved
}
