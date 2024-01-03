import { resolveModule } from 'local-pkg'
import { normalize, relative, resolve } from 'pathe'
import c from 'picocolors'
import type { ResolvedConfig as ResolvedViteConfig } from 'vite'
import type { ApiConfig, ResolvedConfig, UserConfig, VitestRunMode } from '../types'
import { defaultBrowserPort, defaultPort } from '../constants'
import { benchmarkConfigDefaults, configDefaults } from '../defaults'
import { isCI, stdProvider, toArray } from '../utils'
import type { BuiltinPool } from '../types/pool-options'
import { VitestCache } from './cache'
import { BaseSequencer } from './sequencers/BaseSequencer'
import { RandomSequencer } from './sequencers/RandomSequencer'
import type { BenchmarkBuiltinReporters } from './reporters'
import { builtinPools } from './pool'

const extraInlineDeps = [
  /^(?!.*(?:node_modules)).*\.mjs$/,
  /^(?!.*(?:node_modules)).*\.cjs\.js$/,
  // Vite client
  /vite\w*\/dist\/client\/env.mjs/,
  // Nuxt
  '@nuxt/test-utils',
]

function resolvePath(path: string, root: string) {
  return normalize(
    resolveModule(path, { paths: [root] })
      ?? resolve(root, path),
  )
}

export function resolveApiServerConfig<Options extends ApiConfig & UserConfig>(
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
    if (!api.port && !api.middlewareMode)
      api.port = defaultPort
  }
  else {
    api = { middlewareMode: true }
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
  } as any as ResolvedConfig

  resolved.inspect = Boolean(resolved.inspect)
  resolved.inspectBrk = Boolean(resolved.inspectBrk)

  if (viteConfig.base !== '/')
    resolved.base = viteConfig.base

  if (options.shard) {
    if (resolved.watch)
      throw new Error('You cannot use --shard option with enabled watch')

    const [indexString, countString] = options.shard.split('/')
    const index = Math.abs(Number.parseInt(indexString, 10))
    const count = Math.abs(Number.parseInt(countString, 10))

    if (Number.isNaN(count) || count <= 0)
      throw new Error('--shard <count> must be a positive number')

    if (Number.isNaN(index) || index <= 0 || index > count)
      throw new Error('--shard <index> must be a positive number less then <count>')

    resolved.shard = { index, count }
  }

  resolved.fileParallelism ??= true

  if (!resolved.fileParallelism) {
    // ignore user config, parallelism cannot be implemented without limiting workers
    resolved.maxWorkers = 1
    resolved.minWorkers = 1
  }

  if (resolved.inspect || resolved.inspectBrk) {
    const isSingleThread = resolved.pool === 'threads' && resolved.poolOptions?.threads?.singleThread
    const isSingleFork = resolved.pool === 'forks' && resolved.poolOptions?.forks?.singleFork

    if (resolved.fileParallelism && !isSingleThread && !isSingleFork) {
      const inspectOption = `--inspect${resolved.inspectBrk ? '-brk' : ''}`
      throw new Error(`You cannot use ${inspectOption} without "--no-file-parallelism", "poolOptions.threads.singleThread" or "poolOptions.forks.singleFork"`)
    }
  }

  // @ts-expect-error -- check for removed API option
  if (resolved.coverage.provider === 'c8')
    throw new Error('"coverage.provider: c8" is not supported anymore. Use "coverage.provider: v8" instead')

  if (resolved.coverage.provider === 'v8' && resolved.coverage.enabled && isBrowserEnabled(resolved))
    throw new Error('@vitest/coverage-v8 does not work with --browser. Use @vitest/coverage-istanbul instead')

  resolved.deps ??= {}
  resolved.deps.moduleDirectories ??= []
  resolved.deps.moduleDirectories = resolved.deps.moduleDirectories.map((dir) => {
    if (!dir.startsWith('/'))
      dir = `/${dir}`
    if (!dir.endsWith('/'))
      dir += '/'
    return normalize(dir)
  })
  if (!resolved.deps.moduleDirectories.includes('/node_modules/'))
    resolved.deps.moduleDirectories.push('/node_modules/')

  resolved.deps.optimizer ??= {}
  resolved.deps.optimizer.ssr ??= {}
  resolved.deps.optimizer.ssr.enabled ??= true
  resolved.deps.optimizer.web ??= {}
  resolved.deps.optimizer.web.enabled ??= true

  resolved.deps.web ??= {}
  resolved.deps.web.transformAssets ??= true
  resolved.deps.web.transformCss ??= true
  resolved.deps.web.transformGlobPattern ??= []

  resolved.server ??= {}
  resolved.server.deps ??= {}

  const deprecatedDepsOptions = ['inline', 'external', 'fallbackCJS'] as const
  deprecatedDepsOptions.forEach((option) => {
    if (resolved.deps[option] === undefined)
      return

    if (option === 'fallbackCJS') {
      console.warn(c.yellow(`${c.inverse(c.yellow(' Vitest '))} "deps.${option}" is deprecated. Use "server.deps.${option}" instead`))
    }
    else {
      const transformMode = resolved.environment === 'happy-dom' || resolved.environment === 'jsdom' ? 'web' : 'ssr'
      console.warn(
        c.yellow(
        `${c.inverse(c.yellow(' Vitest '))} "deps.${option}" is deprecated. If you rely on vite-node directly, use "server.deps.${option}" instead. Otherwise, consider using "deps.optimizer.${transformMode}.${option === 'external' ? 'exclude' : 'include'}"`,
        ),
      )
    }

    if (resolved.server.deps![option] === undefined)
      resolved.server.deps![option] = resolved.deps[option] as any
  })

  if (resolved.cliExclude)
    resolved.exclude.push(...resolved.cliExclude)

  // vitenode will try to import such file with native node,
  // but then our mocker will not work properly
  if (resolved.server.deps.inline !== true) {
    const ssrOptions = viteConfig.ssr
    if (ssrOptions?.noExternal === true && resolved.server.deps.inline == null) {
      resolved.server.deps.inline = true
    }
    else {
      resolved.server.deps.inline ??= []
      resolved.server.deps.inline.push(...extraInlineDeps)
    }
  }

  resolved.server.deps.moduleDirectories ??= []
  resolved.server.deps.moduleDirectories.push(...resolved.deps.moduleDirectories)

  if (resolved.runner)
    resolved.runner = resolvePath(resolved.runner, resolved.root)

  resolved.testNamePattern = resolved.testNamePattern
    ? resolved.testNamePattern instanceof RegExp
      ? resolved.testNamePattern
      : new RegExp(resolved.testNamePattern)
    : undefined

  if (resolved.snapshotFormat && 'plugins' in resolved.snapshotFormat)
    (resolved.snapshotFormat as any).plugins = []

  const UPDATE_SNAPSHOT = resolved.update || process.env.UPDATE_SNAPSHOT
  resolved.snapshotOptions = {
    expand: resolved.expandSnapshotDiff ?? false,
    snapshotFormat: resolved.snapshotFormat || {},
    updateSnapshot: (isCI && !UPDATE_SNAPSHOT)
      ? 'none'
      : UPDATE_SNAPSHOT
        ? 'all'
        : 'new',
    resolveSnapshotPath: options.resolveSnapshotPath,
    // resolved inside the worker
    snapshotEnvironment: null as any,
  }

  if (options.resolveSnapshotPath)
    delete (resolved as UserConfig).resolveSnapshotPath

  resolved.pool ??= 'threads'

  if (process.env.VITEST_MAX_THREADS) {
    resolved.poolOptions = {
      ...resolved.poolOptions,
      threads: {
        ...resolved.poolOptions?.threads,
        maxThreads: Number.parseInt(process.env.VITEST_MAX_THREADS),
      },
      vmThreads: {
        ...resolved.poolOptions?.vmThreads,
        maxThreads: Number.parseInt(process.env.VITEST_MAX_THREADS),
      },
    }
  }

  if (process.env.VITEST_MIN_THREADS) {
    resolved.poolOptions = {
      ...resolved.poolOptions,
      threads: {
        ...resolved.poolOptions?.threads,
        minThreads: Number.parseInt(process.env.VITEST_MIN_THREADS),
      },
      vmThreads: {
        ...resolved.poolOptions?.vmThreads,
        minThreads: Number.parseInt(process.env.VITEST_MIN_THREADS),
      },
    }
  }

  if (process.env.VITEST_MAX_FORKS) {
    resolved.poolOptions = {
      ...resolved.poolOptions,
      forks: {
        ...resolved.poolOptions?.forks,
        maxForks: Number.parseInt(process.env.VITEST_MAX_FORKS),
      },
    }
  }

  if (process.env.VITEST_MIN_FORKS) {
    resolved.poolOptions = {
      ...resolved.poolOptions,
      forks: {
        ...resolved.poolOptions?.forks,
        minForks: Number.parseInt(process.env.VITEST_MIN_FORKS),
      },
    }
  }

  if (resolved.workspace) {
    // if passed down from the CLI and it's relative, resolve relative to CWD
    resolved.workspace = options.workspace && options.workspace[0] === '.'
      ? resolve(process.cwd(), options.workspace)
      : resolvePath(resolved.workspace, resolved.root)
  }

  if (!builtinPools.includes(resolved.pool as BuiltinPool))
    resolved.pool = resolvePath(resolved.pool, resolved.root)
  resolved.poolMatchGlobs = (resolved.poolMatchGlobs || []).map(([glob, pool]) => {
    if (!builtinPools.includes(pool as BuiltinPool))
      pool = resolvePath(pool, resolved.root)
    return [glob, pool]
  })

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
    resolvePath(file, resolved.root),
  )
  resolved.globalSetup = toArray(resolved.globalSetup || []).map(file =>
    resolvePath(file, resolved.root),
  )
  resolved.coverage.exclude.push(...resolved.setupFiles.map(file => `${resolved.coverage.allowExternal ? '**/' : ''}${relative(resolved.root, file)}`))

  resolved.forceRerunTriggers = [
    ...resolved.forceRerunTriggers,
    ...resolved.setupFiles,
  ]

  if (resolved.diff) {
    resolved.diff = resolvePath(resolved.diff, resolved.root)
    resolved.forceRerunTriggers.push(resolved.diff)
  }

  // the server has been created, we don't need to override vite.server options
  resolved.api = resolveApiServerConfig(options)

  if (options.related)
    resolved.related = toArray(options.related).map(file => resolve(resolved.root, file))

  if (mode !== 'benchmark') {
    // @ts-expect-error "reporter" is from CLI, should be absolute to the running directory
    // it is passed down as "vitest --reporter ../reporter.js"
    const cliReporters = toArray(resolved.reporter || []).map((reporter: string) => {
      // ./reporter.js || ../reporter.js, but not .reporters/reporter.js
      if (/^\.\.?\//.test(reporter))
        return resolve(process.cwd(), reporter)
      return reporter
    })
    const reporters = cliReporters.length ? cliReporters : resolved.reporters
    resolved.reporters = Array.from(new Set(toArray(reporters as 'json'[]))).filter(Boolean)
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
    resolved.cache.dir = VitestCache.resolveCacheDir(resolved.root, resolved.cache.dir, resolved.name)

  resolved.sequence ??= {} as any
  if (!resolved.sequence?.sequencer) {
    // CLI flag has higher priority
    resolved.sequence.sequencer = resolved.sequence.shuffle
      ? RandomSequencer
      : BaseSequencer
  }
  resolved.sequence.hooks ??= 'parallel'
  if (resolved.sequence.sequencer === RandomSequencer)
    resolved.sequence.seed ??= Date.now()

  resolved.typecheck = {
    ...configDefaults.typecheck,
    ...resolved.typecheck,
  }

  resolved.environmentMatchGlobs = (resolved.environmentMatchGlobs || []).map(i => [resolve(resolved.root, i[0]), i[1]])

  resolved.typecheck ??= {} as any
  resolved.typecheck.enabled ??= false

  if (resolved.typecheck.enabled)
    console.warn(c.yellow('Testing types with tsc and vue-tsc is an experimental feature.\nBreaking changes might not follow SemVer, please pin Vitest\'s version when using it.'))

  resolved.browser ??= {} as any
  resolved.browser.enabled ??= false
  resolved.browser.headless ??= isCI
  resolved.browser.slowHijackESM ??= false
  resolved.browser.isolate ??= true

  if (resolved.browser.enabled && stdProvider === 'stackblitz')
    resolved.browser.provider = 'none'

  resolved.browser.api = resolveApiServerConfig(resolved.browser) || {
    port: defaultBrowserPort,
  }

  resolved.testTransformMode ??= {}

  return resolved
}

export function isBrowserEnabled(config: ResolvedConfig): boolean {
  return Boolean(config.browser?.enabled)
}
