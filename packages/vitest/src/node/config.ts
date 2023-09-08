import { totalmem } from 'node:os'
import { resolveModule } from 'local-pkg'
import { normalize, relative, resolve } from 'pathe'
import c from 'picocolors'
import type { ResolvedConfig as ResolvedViteConfig } from 'vite'
import type { ApiConfig, ResolvedConfig, UserConfig, VitestRunMode } from '../types'
import { defaultBrowserPort, defaultPort } from '../constants'
import { benchmarkConfigDefaults, configDefaults } from '../defaults'
import { isCI, toArray } from '../utils'
import { getWorkerMemoryLimit, stringToBytes } from '../utils/memory-limit'
import { VitestCache } from './cache'
import { BaseSequencer } from './sequencers/BaseSequencer'
import { RandomSequencer } from './sequencers/RandomSequencer'
import type { BenchmarkBuiltinReporters } from './reporters'

const extraInlineDeps = [
  /^(?!.*(?:node_modules)).*\.mjs$/,
  /^(?!.*(?:node_modules)).*\.cjs\.js$/,
  // Vite client
  /vite\w*\/dist\/client\/env.mjs/,
  // Nuxt
  '@nuxt/test-utils',
]

export function resolveApiServerConfig<Options extends ApiConfig & UserConfig>(
  options: Options,
): ApiConfig | undefined {
  let api: ApiConfig | undefined

  const optimizer = options.deps?.optimizer
  const optimizerEnabled = optimizer?.web?.enabled !== false || optimizer?.ssr?.enabled !== false
  const needApi = options.ui || optimizerEnabled

  if (needApi && !options.api)
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
  resolved.singleThread = Boolean(resolved.singleThread)

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

  if (resolved.inspect || resolved.inspectBrk) {
    if (resolved.threads !== false && resolved.singleThread !== true) {
      const inspectOption = `--inspect${resolved.inspectBrk ? '-brk' : ''}`
      throw new Error(`You cannot use ${inspectOption} without "threads: false" or "singleThread: true"`)
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

  // vitenode will try to import such file with native node,
  // but then our mocker will not work properly
  if (resolved.server.deps.inline !== true) {
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore ssr is not typed in Vite 2, but defined in Vite 3, so we can't use expect-error
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

  if (resolved.runner) {
    resolved.runner = resolveModule(resolved.runner, { paths: [resolved.root] })
      ?? resolve(resolved.root, resolved.runner)
  }

  if (resolved.deps.registerNodeLoader) {
    const transformMode = resolved.environment === 'happy-dom' || resolved.environment === 'jsdom' ? 'web' : 'ssr'
    console.warn(
      c.yellow(
      `${c.inverse(c.yellow(' Vitest '))} "deps.registerNodeLoader" is deprecated.`
      + `If you rely on aliases inside external packages, use "deps.optimizer.${transformMode}.include" instead.`,
      ),
    )
  }

  resolved.testNamePattern = resolved.testNamePattern
    ? resolved.testNamePattern instanceof RegExp
      ? resolved.testNamePattern
      : new RegExp(resolved.testNamePattern)
    : undefined

  const UPDATE_SNAPSHOT = resolved.update || process.env.UPDATE_SNAPSHOT
  resolved.snapshotOptions = {
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

  const memory = totalmem()
  const limit = getWorkerMemoryLimit(resolved)

  if (typeof memory === 'number') {
    resolved.experimentalVmWorkerMemoryLimit = stringToBytes(
      limit,
      resolved.watch ? memory / 2 : memory,
    )
  }
  else if (limit > 1) {
    resolved.experimentalVmWorkerMemoryLimit = stringToBytes(limit)
  }
  else {
    // just ignore "experimentalVmWorkerMemoryLimit" value because we cannot detect memory limit
  }

  if (options.resolveSnapshotPath)
    delete (resolved as UserConfig).resolveSnapshotPath

  if (process.env.VITEST_MAX_THREADS)
    resolved.maxThreads = Number.parseInt(process.env.VITEST_MAX_THREADS)

  if (process.env.VITEST_MIN_THREADS)
    resolved.minThreads = Number.parseInt(process.env.VITEST_MIN_THREADS)

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
  resolved.coverage.exclude.push(...resolved.setupFiles.map(file => `${resolved.coverage.allowExternal ? '**/' : ''}${relative(resolved.root, file)}`))

  resolved.forceRerunTriggers = [
    ...resolved.forceRerunTriggers,
    ...resolved.setupFiles,
  ]

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

  if (mode === 'typecheck') {
    resolved.include = resolved.typecheck.include
    resolved.exclude = resolved.typecheck.exclude
  }

  resolved.browser ??= {} as any
  resolved.browser.enabled ??= false
  resolved.browser.headless ??= isCI
  resolved.browser.slowHijackESM ??= true

  resolved.browser.api = resolveApiServerConfig(resolved.browser) || {
    port: defaultBrowserPort,
  }

  resolved.testTransformMode ??= {}

  return resolved
}

export function isBrowserEnabled(config: ResolvedConfig) {
  if (config.browser?.enabled)
    return true

  return config.poolMatchGlobs?.length && config.poolMatchGlobs.some(([, pool]) => pool === 'browser')
}
