import { resolve } from 'pathe'
import type { ResolvedConfig as ResolvedViteConfig } from 'vite'
import type { ResolvedConfig, UserConfig } from '../types'
import { defaultExclude, defaultInclude, defaultPort } from '../constants'
import { resolveC8Options } from '../coverage'
import { deepMerge, toArray } from '../utils'

export function resolveConfig(
  options: UserConfig,
  viteConfig: ResolvedViteConfig,
): ResolvedConfig {
  if (options.dom)
    options.environment = 'happy-dom'

  const resolved = {
    ...deepMerge(options, viteConfig.test),
    root: viteConfig.root,
  } as ResolvedConfig

  resolved.coverage = resolveC8Options(resolved.coverage, resolved.root)

  resolved.depsInline = [...resolved.deps?.inline || []]
  resolved.depsExternal = [...resolved.deps?.external || []]

  resolved.environment = resolved.environment || 'node'
  resolved.threads = resolved.threads ?? true
  resolved.interpretDefault = resolved.interpretDefault ?? true

  resolved.clearMocks = resolved.clearMocks ?? false
  resolved.restoreMocks = resolved.restoreMocks ?? false
  resolved.mockReset = resolved.mockReset ?? false

  resolved.include = resolved.include ?? defaultInclude
  resolved.exclude = resolved.exclude ?? defaultExclude

  resolved.testTimeout = resolved.testTimeout ?? 5_000
  resolved.hookTimeout = resolved.hookTimeout ?? 10_000

  resolved.isolate = resolved.isolate ?? true

  resolved.testNamePattern = resolved.testNamePattern
    ? resolved.testNamePattern instanceof RegExp
      ? resolved.testNamePattern
      : new RegExp(resolved.testNamePattern)
    : undefined

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

  if (options.findRelatedTests)
    resolved.findRelatedTests = toArray(options.findRelatedTests).map(file => resolve(resolved.root, file))

  return resolved
}
