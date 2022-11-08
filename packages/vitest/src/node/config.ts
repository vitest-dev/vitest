import { resolveModule } from 'local-pkg'
import { normalize, resolve } from 'pathe'
import c from 'picocolors'
import type { ResolvedConfig as ResolvedViteConfig } from 'vite'

import type { ApiConfig, ResolvedConfig, UserConfig, VitestRunMode } from '../types'
import { defaultPort } from '../constants'
import { benchmarkConfigDefaults, configDefaults } from '../defaults'
import { toArray } from '../utils'
import { VitestCache } from './cache'
import { BaseSequencer } from './sequencers/BaseSequencer'
import { RandomSequencer } from './sequencers/RandomSequencer'
import type { BenchmarkBuiltinReporters } from './reporters'

const extraInlineDeps = [
  /^(?!.*(?:node_modules)).*\.mjs$/,
  /^(?!.*(?:node_modules)).*\.cjs\.js$/,
  // Vite client
  /vite\w*\/dist\/client\/env.mjs/,
  // Vitest
  /\/vitest\/dist\//,
  // yarn's .store folder
  /vitest-virtual-\w+\/dist/,
  // cnpm
  /@vitest\/dist/,
  // Nuxt
  '@nuxt/test-utils',
]

export function resolveApiConfig<Options extends ApiConfig & UserConfig>(
  options: Options,
): ApiConfig | undefined {
  let api: ApiConfig | undefined

  if ((options.ui || options.browser) && !options.api)
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
  mode: VitestRunMode,
  options: UserConfig,
  viteConfig: ResolvedViteConfig,
): ResolvedConfig {
  if (options.dom) {
    if (
      viteConfig.test?.environment != null
      && viteConfig.test!.environment !== 'happy-dom'
    ) {
      console.warn(
        c.yellow(
          `${c.inverse(c.yellow(' Vitest '))} Your config.test.environment ("${
            viteConfig.test.environment
          }") conflicts with --dom flag ("happy-dom"), ignoring "${
            viteConfig.test.environment
          }"`,
        ),
      )
    }

    options.environment = 'happy-dom'
  }

  const resolved = {
    ...configDefaults,
    ...options,
    root: viteConfig.root,
    mode,
  } as ResolvedConfig

  if (viteConfig.base !== '/')
    resolved.base = viteConfig.base

  if (options.shard) {
    if (resolved.watch)
      throw new Error('You cannot use --shard option with enabled watch')

    const [indexString, countString] = options.shard.split('/')
    const index = Math.abs(parseInt(indexString, 10))
    const count = Math.abs(parseInt(countString, 10))

    if (isNaN(count) || count <= 0)
      throw new Error('--shard <count> must be a positive number')

    if (isNaN(index) || index <= 0 || index > count)
      throw new Error('--shard <index> must be a positive number less then <count>')

    resolved.shard = { index, count }
  }

  resolved.deps = resolved.deps || {}
  // vitenode will try to import such file with native node,
  // but then our mocker will not work properly
  if (resolved.deps.inline !== true) {
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore ssr is not typed in Vite 2, but defined in Vite 3, so we can't use expect-error
    const ssrOptions = viteConfig.ssr

    if (ssrOptions?.noExternal === true && resolved.deps.inline == null) {
      resolved.deps.inline = true
    }
    else {
      resolved.deps.inline ??= []
      resolved.deps.inline.push(...extraInlineDeps)
    }
  }

  // disable loader for Yarn PnP until Node implements chain loader
  // https://github.com/nodejs/node/pull/43772
  resolved.deps.registerNodeLoader ??= false

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
    resolveSnapshotPath: options.resolveSnapshotPath,
  }

  if (options.resolveSnapshotPath)
    delete (resolved as UserConfig).resolveSnapshotPath

  if (process.env.VITEST_MAX_THREADS)
    resolved.maxThreads = parseInt(process.env.VITEST_MAX_THREADS)

  if (process.env.VITEST_MIN_THREADS)
    resolved.minThreads = parseInt(process.env.VITEST_MIN_THREADS)

  if (mode === 'benchmark') {
    resolved.benchmark = {
      ...benchmarkConfigDefaults,
      ...resolved.benchmark,
    }
    // override test config
    resolved.coverage.enabled = false
    resolved.include = resolved.benchmark.include
    resolved.exclude = resolved.benchmark.exclude
    resolved.includeSource = resolved.benchmark.includeSource
    const reporters = Array.from(new Set<BenchmarkBuiltinReporters>([
      ...toArray(resolved.benchmark.reporters),
      // @ts-expect-error reporter is CLI flag
      ...toArray(options.reporter),
    ])).filter(Boolean)
    if (reporters.length)
      resolved.benchmark.reporters = reporters
    else
      resolved.benchmark.reporters = ['default']

    if (options.outputFile)
      resolved.benchmark.outputFile = options.outputFile
  }

  resolved.setupFiles = toArray(resolved.setupFiles || []).map(file =>
    normalize(
      resolveModule(file, { paths: [resolved.root] })
        ?? resolve(resolved.root, file),
    ),
  )

  // the server has been created, we don't need to override vite.server options
  resolved.api = resolveApiConfig(options)

  if (options.related)
    resolved.related = toArray(options.related).map(file => resolve(resolved.root, file))

  if (mode !== 'benchmark') {
    resolved.reporters = Array.from(new Set([
      ...toArray(resolved.reporters),
      // @ts-expect-error from CLI
      ...toArray(resolved.reporter),
    ])).filter(Boolean)
  }

  if (!resolved.reporters.length)
    resolved.reporters.push('default')

  if (resolved.changed)
    resolved.passWithNoTests ??= true

  resolved.css ??= {}
  if (typeof resolved.css === 'object') {
    resolved.css.modules ??= {}
    resolved.css.modules.classNameStrategy ??= 'stable'
  }

  resolved.cache ??= { dir: '' }
  if (resolved.cache)
    resolved.cache.dir = VitestCache.resolveCacheDir(resolved.root, resolved.cache.dir)

  resolved.sequence ??= {} as any
  if (!resolved.sequence?.sequencer) {
    // CLI flag has higher priority
    resolved.sequence.sequencer = resolved.sequence.shuffle
      ? RandomSequencer
      : BaseSequencer
  }
  resolved.sequence.hooks ??= 'parallel'

  resolved.typecheck = {
    ...configDefaults.typecheck,
    ...resolved.typecheck,
  }

  if (mode === 'typecheck') {
    resolved.include = resolved.typecheck.include
    resolved.exclude = resolved.typecheck.exclude
  }

  return resolved
}
