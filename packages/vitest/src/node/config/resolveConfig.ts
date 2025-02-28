import type { ResolvedConfig as ResolvedViteConfig } from 'vite'
import type { Vitest } from '../core'
import type { BenchmarkBuiltinReporters } from '../reporters'
import type {
  ApiConfig,
  ResolvedConfig,
  UserConfig,
} from '../types/config'
import type { BaseCoverageOptions, CoverageReporterWithOptions } from '../types/coverage'
import type { BuiltinPool, ForksOptions, PoolOptions, ThreadsOptions } from '../types/pool-options'
import crypto from 'node:crypto'
import { toArray } from '@vitest/utils'
import { resolveModule } from 'local-pkg'
import { normalize, relative, resolve } from 'pathe'
import c from 'tinyrainbow'
import {
  defaultBrowserPort,
  defaultInspectPort,
  defaultPort,
  extraInlineDeps,
} from '../../constants'
import { benchmarkConfigDefaults, configDefaults } from '../../defaults'
import { isCI, stdProvider } from '../../utils/env'
import { getWorkersCountByPercentage } from '../../utils/workers'
import { VitestCache } from '../cache'
import { builtinPools } from '../pool'
import { BaseSequencer } from '../sequencers/BaseSequencer'
import { RandomSequencer } from '../sequencers/RandomSequencer'

function resolvePath(path: string, root: string) {
  return normalize(
    /* @__PURE__ */ resolveModule(path, { paths: [root] })
    ?? resolve(root, path),
  )
}

function parseInspector(inspect: string | undefined | boolean | number) {
  if (typeof inspect === 'boolean' || inspect === undefined) {
    return {}
  }
  if (typeof inspect === 'number') {
    return { port: inspect }
  }

  if (inspect.match(/https?:\//)) {
    throw new Error(
      `Inspector host cannot be a URL. Use "host:port" instead of "${inspect}"`,
    )
  }

  const [host, port] = inspect.split(':')
  if (!port) {
    return { host }
  }
  return { host, port: Number(port) || defaultInspectPort }
}

export function resolveApiServerConfig<Options extends ApiConfig & UserConfig>(
  options: Options,
  defaultPort: number,
): ApiConfig | undefined {
  let api: ApiConfig | undefined

  if (options.ui && !options.api) {
    api = { port: defaultPort }
  }
  else if (options.api === true) {
    api = { port: defaultPort }
  }
  else if (typeof options.api === 'number') {
    api = { port: options.api }
  }

  if (typeof options.api === 'object') {
    if (api) {
      if (options.api.port) {
        api.port = options.api.port
      }
      if (options.api.strictPort) {
        api.strictPort = options.api.strictPort
      }
      if (options.api.host) {
        api.host = options.api.host
      }
    }
    else {
      api = { ...options.api }
    }
  }

  if (api) {
    if (!api.port && !api.middlewareMode) {
      api.port = defaultPort
    }
  }
  else {
    api = { middlewareMode: true }
  }

  return api
}

function resolveInlineWorkerOption(value: string | number): number {
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    return getWorkersCountByPercentage(value)
  }
  else {
    return Number(value)
  }
}

export function resolveConfig(
  vitest: Vitest,
  options: UserConfig,
  viteConfig: ResolvedViteConfig,
): ResolvedConfig {
  const mode = vitest.mode
  const logger = vitest.logger
  if (options.dom) {
    if (
      viteConfig.test?.environment != null
      && viteConfig.test!.environment !== 'happy-dom'
    ) {
      logger.console.warn(
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

  resolved.project = toArray(resolved.project)
  resolved.provide ??= {}

  const inspector = resolved.inspect || resolved.inspectBrk

  resolved.inspector = {
    ...resolved.inspector,
    ...parseInspector(inspector),
    enabled: !!inspector,
    waitForDebugger:
      options.inspector?.waitForDebugger ?? !!resolved.inspectBrk,
  }

  if (viteConfig.base !== '/') {
    resolved.base = viteConfig.base
  }

  resolved.clearScreen = resolved.clearScreen ?? viteConfig.clearScreen ?? true

  if (options.shard) {
    if (resolved.watch) {
      throw new Error('You cannot use --shard option with enabled watch')
    }

    const [indexString, countString] = options.shard.split('/')
    const index = Math.abs(Number.parseInt(indexString, 10))
    const count = Math.abs(Number.parseInt(countString, 10))

    if (Number.isNaN(count) || count <= 0) {
      throw new Error('--shard <count> must be a positive number')
    }

    if (Number.isNaN(index) || index <= 0 || index > count) {
      throw new Error(
        '--shard <index> must be a positive number less then <count>',
      )
    }

    resolved.shard = { index, count }
  }

  if (resolved.standalone && !resolved.watch) {
    throw new Error(`Vitest standalone mode requires --watch`)
  }

  if (resolved.mergeReports && resolved.watch) {
    throw new Error(`Cannot merge reports with --watch enabled`)
  }

  if (resolved.maxWorkers) {
    resolved.maxWorkers = resolveInlineWorkerOption(resolved.maxWorkers)
  }

  if (resolved.minWorkers) {
    resolved.minWorkers = resolveInlineWorkerOption(resolved.minWorkers)
  }

  resolved.browser ??= {} as any

  // run benchmark sequentially by default
  resolved.fileParallelism ??= mode !== 'benchmark'

  if (!resolved.fileParallelism) {
    // ignore user config, parallelism cannot be implemented without limiting workers
    resolved.maxWorkers = 1
    resolved.minWorkers = 1
  }

  if (resolved.maxConcurrency === 0) {
    logger.console.warn(
      c.yellow(`The option "maxConcurrency" cannot be set to 0. Using default value ${configDefaults.maxConcurrency} instead.`),
    )
    resolved.maxConcurrency = configDefaults.maxConcurrency
  }

  if (resolved.inspect || resolved.inspectBrk) {
    const isSingleThread
      = resolved.pool === 'threads'
        && resolved.poolOptions?.threads?.singleThread
    const isSingleFork
      = resolved.pool === 'forks' && resolved.poolOptions?.forks?.singleFork

    if (resolved.fileParallelism && !isSingleThread && !isSingleFork) {
      const inspectOption = `--inspect${resolved.inspectBrk ? '-brk' : ''}`
      throw new Error(
        `You cannot use ${inspectOption} without "--no-file-parallelism", "poolOptions.threads.singleThread" or "poolOptions.forks.singleFork"`,
      )
    }
  }

  const browser = resolved.browser

  if (browser.enabled) {
    if (!browser.name && !browser.instances) {
      // CLI can enable `--browser.*` flag to change config of workspace projects
      // the same flag will be applied to the root config that doesn't have to have "name" or "instances"
      // in this case we just disable the browser mode
      browser.enabled = false
    }
    else {
      const instances = browser.instances
      if (browser.name && browser.instances) {
        // --browser=chromium filters configs to a single one
        browser.instances = browser.instances.filter(instance => instance.browser === browser.name)
      }

      if (browser.instances && !browser.instances.length) {
        throw new Error([
          `"browser.instances" was set in the config, but the array is empty. Define at least one browser config.`,
          browser.name && instances?.length ? ` The "browser.name" was set to "${browser.name}" which filtered all configs (${instances.map(c => c.browser).join(', ')}). Did you mean to use another name?` : '',
        ].join(''))
      }
    }
  }

  const playwrightChromiumOnly = isPlaywrightChromiumOnly(vitest, resolved)

  // Browser-mode "Playwright + Chromium" only features:
  if (browser.enabled && !playwrightChromiumOnly) {
    const browserConfig = {
      browser: {
        provider: browser.provider,
        name: browser.name,
        instances: browser.instances?.map(i => ({ browser: i.browser })),
      },
    }

    if (resolved.coverage.enabled && resolved.coverage.provider === 'v8') {
      throw new Error(
        `@vitest/coverage-v8 does not work with\n${JSON.stringify(browserConfig, null, 2)}\n`
        + `\nUse either:\n${JSON.stringify({ browser: { provider: 'playwright', instances: [{ browser: 'chromium' }] } }, null, 2)}`
        + `\n\n...or change your coverage provider to:\n${JSON.stringify({ coverage: { provider: 'istanbul' } }, null, 2)}\n`,
      )
    }

    if (resolved.inspect || resolved.inspectBrk) {
      const inspectOption = `--inspect${resolved.inspectBrk ? '-brk' : ''}`

      throw new Error(
        `${inspectOption} does not work with\n${JSON.stringify(browserConfig, null, 2)}\n`
        + `\nUse either:\n${JSON.stringify({ browser: { provider: 'playwright', instances: [{ browser: 'chromium' }] } }, null, 2)}`
        + `\n\n...or disable ${inspectOption}\n`,
      )
    }
  }

  resolved.coverage.reporter = resolveCoverageReporters(resolved.coverage.reporter)

  if (resolved.coverage.enabled && resolved.coverage.reportsDirectory) {
    const reportsDirectory = resolve(
      resolved.root,
      resolved.coverage.reportsDirectory,
    )

    if (
      reportsDirectory === resolved.root
      || reportsDirectory === process.cwd()
    ) {
      throw new Error(
        `You cannot set "coverage.reportsDirectory" as ${reportsDirectory}. Vitest needs to be able to remove this directory before test run`,
      )
    }
  }

  if (resolved.coverage.enabled && resolved.coverage.provider === 'custom' && resolved.coverage.customProviderModule) {
    resolved.coverage.customProviderModule = resolvePath(
      resolved.coverage.customProviderModule,
      resolved.root,
    )
  }

  resolved.expect ??= {}

  resolved.deps ??= {}
  resolved.deps.moduleDirectories ??= []
  resolved.deps.moduleDirectories = resolved.deps.moduleDirectories.map(
    (dir) => {
      if (!dir.startsWith('/')) {
        dir = `/${dir}`
      }
      if (!dir.endsWith('/')) {
        dir += '/'
      }
      return normalize(dir)
    },
  )
  if (!resolved.deps.moduleDirectories.includes('/node_modules/')) {
    resolved.deps.moduleDirectories.push('/node_modules/')
  }

  resolved.deps.optimizer ??= {}
  resolved.deps.optimizer.ssr ??= {}
  resolved.deps.optimizer.ssr.enabled ??= true
  resolved.deps.optimizer.web ??= {}
  resolved.deps.optimizer.web.enabled ??= true

  resolved.deps.web ??= {}
  resolved.deps.web.transformAssets ??= true
  resolved.deps.web.transformCss ??= true
  resolved.deps.web.transformGlobPattern ??= []

  resolved.setupFiles = toArray(resolved.setupFiles || []).map(file =>
    resolvePath(file, resolved.root),
  )
  resolved.globalSetup = toArray(resolved.globalSetup || []).map(file =>
    resolvePath(file, resolved.root),
  )
  resolved.coverage.exclude.push(
    ...resolved.setupFiles.map(
      file =>
        `${resolved.coverage.allowExternal ? '**/' : ''}${relative(
          resolved.root,
          file,
        )}`,
    ),
  )
  resolved.coverage.exclude.push(...resolved.include)

  resolved.forceRerunTriggers = [
    ...resolved.forceRerunTriggers,
    ...resolved.setupFiles,
  ]

  resolved.server ??= {}
  resolved.server.deps ??= {}

  const deprecatedDepsOptions = ['inline', 'external', 'fallbackCJS'] as const
  deprecatedDepsOptions.forEach((option) => {
    if (resolved.deps[option] === undefined) {
      return
    }

    if (option === 'fallbackCJS') {
      logger.console.warn(
        c.yellow(
          `${c.inverse(
            c.yellow(' Vitest '),
          )} "deps.${option}" is deprecated. Use "server.deps.${option}" instead`,
        ),
      )
    }
    else {
      const transformMode
        = resolved.environment === 'happy-dom' || resolved.environment === 'jsdom'
          ? 'web'
          : 'ssr'
      logger.console.warn(
        c.yellow(
          `${c.inverse(
            c.yellow(' Vitest '),
          )} "deps.${option}" is deprecated. If you rely on vite-node directly, use "server.deps.${option}" instead. Otherwise, consider using "deps.optimizer.${transformMode}.${
            option === 'external' ? 'exclude' : 'include'
          }"`,
        ),
      )
    }

    if (resolved.server.deps![option] === undefined) {
      resolved.server.deps![option] = resolved.deps[option] as any
    }
  })

  if (resolved.cliExclude) {
    resolved.exclude.push(...resolved.cliExclude)
  }

  // vitenode will try to import such file with native node,
  // but then our mocker will not work properly
  if (resolved.server.deps.inline !== true) {
    const ssrOptions = viteConfig.ssr
    if (
      ssrOptions?.noExternal === true
      && resolved.server.deps.inline == null
    ) {
      resolved.server.deps.inline = true
    }
    else {
      resolved.server.deps.inline ??= []
      resolved.server.deps.inline.push(...extraInlineDeps)
    }
  }

  resolved.server.deps.inlineFiles ??= []
  resolved.server.deps.inlineFiles.push(...resolved.setupFiles)
  resolved.server.deps.moduleDirectories ??= []
  resolved.server.deps.moduleDirectories.push(
    ...resolved.deps.moduleDirectories,
  )

  if (resolved.runner) {
    resolved.runner = resolvePath(resolved.runner, resolved.root)
  }

  if (resolved.snapshotEnvironment) {
    resolved.snapshotEnvironment = resolvePath(
      resolved.snapshotEnvironment,
      resolved.root,
    )
  }

  resolved.testNamePattern = resolved.testNamePattern
    ? resolved.testNamePattern instanceof RegExp
      ? resolved.testNamePattern
      : new RegExp(resolved.testNamePattern)
    : undefined

  if (resolved.snapshotFormat && 'plugins' in resolved.snapshotFormat) {
    (resolved.snapshotFormat as any).plugins = []
  }

  const UPDATE_SNAPSHOT = resolved.update || process.env.UPDATE_SNAPSHOT
  resolved.snapshotOptions = {
    expand: resolved.expandSnapshotDiff ?? false,
    snapshotFormat: resolved.snapshotFormat || {},
    updateSnapshot:
      isCI && !UPDATE_SNAPSHOT ? 'none' : UPDATE_SNAPSHOT ? 'all' : 'new',
    resolveSnapshotPath: options.resolveSnapshotPath,
    // resolved inside the worker
    snapshotEnvironment: null as any,
  }

  resolved.snapshotSerializers ??= []
  resolved.snapshotSerializers = resolved.snapshotSerializers.map(file =>
    resolvePath(file, resolved.root),
  )
  resolved.forceRerunTriggers.push(...resolved.snapshotSerializers)

  if (options.resolveSnapshotPath) {
    delete (resolved as any).resolveSnapshotPath
  }

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
      vmForks: {
        ...resolved.poolOptions?.vmForks,
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
      vmForks: {
        ...resolved.poolOptions?.vmForks,
        minForks: Number.parseInt(process.env.VITEST_MIN_FORKS),
      },
    }
  }

  const poolThreadsOptions = [
    ['threads', 'minThreads'],
    ['threads', 'maxThreads'],
    ['vmThreads', 'minThreads'],
    ['vmThreads', 'maxThreads'],
  ] as const satisfies [keyof PoolOptions, keyof ThreadsOptions][]

  for (const [poolOptionKey, workerOptionKey] of poolThreadsOptions) {
    if (resolved.poolOptions?.[poolOptionKey]?.[workerOptionKey]) {
      resolved.poolOptions[poolOptionKey]![workerOptionKey] = resolveInlineWorkerOption(resolved.poolOptions[poolOptionKey]![workerOptionKey]!)
    }
  }

  const poolForksOptions = [
    ['forks', 'minForks'],
    ['forks', 'maxForks'],
    ['vmForks', 'minForks'],
    ['vmForks', 'maxForks'],
  ] as const satisfies [keyof PoolOptions, keyof ForksOptions][]

  for (const [poolOptionKey, workerOptionKey] of poolForksOptions) {
    if (resolved.poolOptions?.[poolOptionKey]?.[workerOptionKey]) {
      resolved.poolOptions[poolOptionKey]![workerOptionKey] = resolveInlineWorkerOption(resolved.poolOptions[poolOptionKey]![workerOptionKey]!)
    }
  }

  if (typeof resolved.workspace === 'string') {
    // if passed down from the CLI and it's relative, resolve relative to CWD
    resolved.workspace
      = typeof options.workspace === 'string' && options.workspace[0] === '.'
        ? resolve(process.cwd(), options.workspace)
        : resolvePath(resolved.workspace, resolved.root)
  }

  if (!builtinPools.includes(resolved.pool as BuiltinPool)) {
    resolved.pool = resolvePath(resolved.pool, resolved.root)
  }
  if (resolved.poolMatchGlobs) {
    logger.warn(
      c.yellow(
        `${c.inverse(
          c.yellow(' Vitest '),
        )} "poolMatchGlobs" is deprecated. Use "workspace" to define different configurations instead.`,
      ),
    )
  }
  resolved.poolMatchGlobs = (resolved.poolMatchGlobs || []).map(
    ([glob, pool]) => {
      if (!builtinPools.includes(pool as BuiltinPool)) {
        pool = resolvePath(pool, resolved.root)
      }
      return [glob, pool]
    },
  )

  if (mode === 'benchmark') {
    resolved.benchmark = {
      ...benchmarkConfigDefaults,
      ...resolved.benchmark,
    }
    // override test config
    resolved.coverage.enabled = false
    resolved.typecheck.enabled = false
    resolved.include = resolved.benchmark.include
    resolved.exclude = resolved.benchmark.exclude
    resolved.includeSource = resolved.benchmark.includeSource
    const reporters = Array.from(
      new Set<BenchmarkBuiltinReporters>([
        ...toArray(resolved.benchmark.reporters),
        // @ts-expect-error reporter is CLI flag
        ...toArray(options.reporter),
      ]),
    ).filter(Boolean)
    if (reporters.length) {
      resolved.benchmark.reporters = reporters
    }
    else {
      resolved.benchmark.reporters = ['default']
    }

    if (options.outputFile) {
      resolved.benchmark.outputFile = options.outputFile
    }

    // --compare from cli
    if (options.compare) {
      resolved.benchmark.compare = options.compare
    }
    if (options.outputJson) {
      resolved.benchmark.outputJson = options.outputJson
    }
  }

  if (typeof resolved.diff === 'string') {
    resolved.diff = resolvePath(resolved.diff, resolved.root)
    resolved.forceRerunTriggers.push(resolved.diff)
  }

  // the server has been created, we don't need to override vite.server options
  const api = resolveApiServerConfig(options, defaultPort)
  resolved.api = { ...api, token: crypto.randomUUID() }

  if (options.related) {
    resolved.related = toArray(options.related).map(file =>
      resolve(resolved.root, file),
    )
  }

  /*
   * Reporters can be defined in many different ways:
   * { reporter: 'json' }
   * { reporter: { onFinish() { method() } } }
   * { reporter: ['json', { onFinish() { method() } }] }
   * { reporter: [[ 'json' ]] }
   * { reporter: [[ 'json' ], 'html'] }
   * { reporter: [[ 'json', { outputFile: 'test.json' } ], 'html'] }
   */
  if (options.reporters) {
    if (!Array.isArray(options.reporters)) {
      // Reporter name, e.g. { reporters: 'json' }
      if (typeof options.reporters === 'string') {
        resolved.reporters = [[options.reporters, {}]]
      }
      // Inline reporter e.g. { reporters: { onFinish() { method() } } }
      else {
        resolved.reporters = [options.reporters]
      }
    }
    // It's an array of reporters
    else {
      resolved.reporters = []

      for (const reporter of options.reporters) {
        if (Array.isArray(reporter)) {
          // Reporter with options, e.g. { reporters: [ [ 'json', { outputFile: 'test.json' } ] ] }
          resolved.reporters.push([reporter[0], reporter[1] as Record<string, unknown> || {}])
        }
        else if (typeof reporter === 'string') {
          // Reporter name in array, e.g. { reporters: ["html", "json"]}
          resolved.reporters.push([reporter, {}])
        }
        else {
          // Inline reporter, e.g. { reporter: [{ onFinish() { method() } }] }
          resolved.reporters.push(reporter)
        }
      }
    }
  }

  if (mode !== 'benchmark') {
    // @ts-expect-error "reporter" is from CLI, should be absolute to the running directory
    // it is passed down as "vitest --reporter ../reporter.js"
    const reportersFromCLI = resolved.reporter

    const cliReporters = toArray(reportersFromCLI || []).map(
      (reporter: string) => {
        // ./reporter.js || ../reporter.js, but not .reporters/reporter.js
        if (/^\.\.?\//.test(reporter)) {
          return resolve(process.cwd(), reporter)
        }
        return reporter
      },
    )

    if (cliReporters.length) {
      resolved.reporters = Array.from(new Set(toArray(cliReporters)))
        .filter(Boolean)
        .map(reporter => [reporter, {}])
    }
  }

  if (!resolved.reporters.length) {
    resolved.reporters.push(['default', {}])

    // also enable github-actions reporter as a default
    if (process.env.GITHUB_ACTIONS === 'true') {
      resolved.reporters.push(['github-actions', {}])
    }
  }

  if (resolved.changed) {
    resolved.passWithNoTests ??= true
  }

  resolved.css ??= {}
  if (typeof resolved.css === 'object') {
    resolved.css.modules ??= {}
    resolved.css.modules.classNameStrategy ??= 'stable'
  }

  if (resolved.cache !== false) {
    let cacheDir = VitestCache.resolveCacheDir(
      '',
      viteConfig.cacheDir,
      resolved.name,
    )

    if (resolved.cache && resolved.cache.dir) {
      logger.console.warn(
        c.yellow(
          `${c.inverse(
            c.yellow(' Vitest '),
          )} "cache.dir" is deprecated, use Vite's "cacheDir" instead if you want to change the cache director. Note caches will be written to "cacheDir\/vitest"`,
        ),
      )

      cacheDir = VitestCache.resolveCacheDir(
        resolved.root,
        resolved.cache.dir,
        resolved.name,
      )
    }

    resolved.cache = { dir: cacheDir }
  }

  resolved.sequence ??= {} as any
  if (
    resolved.sequence.shuffle
    && typeof resolved.sequence.shuffle === 'object'
  ) {
    const { files, tests } = resolved.sequence.shuffle
    resolved.sequence.sequencer ??= files ? RandomSequencer : BaseSequencer
    resolved.sequence.shuffle = tests
  }
  if (!resolved.sequence?.sequencer) {
    // CLI flag has higher priority
    resolved.sequence.sequencer = resolved.sequence.shuffle
      ? RandomSequencer
      : BaseSequencer
  }
  resolved.sequence.hooks ??= 'stack'
  if (resolved.sequence.sequencer === RandomSequencer) {
    resolved.sequence.seed ??= Date.now()
  }

  resolved.typecheck = {
    ...configDefaults.typecheck,
    ...resolved.typecheck,
  }

  if (resolved.environmentMatchGlobs) {
    logger.warn(
      c.yellow(
        `${c.inverse(
          c.yellow(' Vitest '),
        )} "environmentMatchGlobs" is deprecated. Use "workspace" to define different configurations instead.`,
      ),
    )
  }
  resolved.environmentMatchGlobs = (resolved.environmentMatchGlobs || []).map(
    i => [resolve(resolved.root, i[0]), i[1]],
  )

  resolved.typecheck ??= {} as any
  resolved.typecheck.enabled ??= false

  if (resolved.typecheck.enabled) {
    logger.console.warn(
      c.yellow(
        'Testing types with tsc and vue-tsc is an experimental feature.\nBreaking changes might not follow SemVer, please pin Vitest\'s version when using it.',
      ),
    )
  }

  resolved.browser ??= {} as any
  resolved.browser.enabled ??= false
  resolved.browser.headless ??= isCI
  resolved.browser.isolate ??= true
  resolved.browser.fileParallelism
    ??= options.fileParallelism ?? mode !== 'benchmark'
  // disable in headless mode by default, and if CI is detected
  resolved.browser.ui ??= resolved.browser.headless === true ? false : !isCI
  if (resolved.browser.screenshotDirectory) {
    resolved.browser.screenshotDirectory = resolve(
      resolved.root,
      resolved.browser.screenshotDirectory,
    )
  }
  const isPreview = resolved.browser.provider === 'preview'
  if (isPreview && resolved.browser.screenshotFailures === true) {
    console.warn(c.yellow(
      [
        `Browser provider "preview" doesn't support screenshots, `,
        `so "browser.screenshotFailures" option is forcefully disabled. `,
        `Set "browser.screenshotFailures" to false or remove it from the config to suppress this warning.`,
      ].join(''),
    ))
    resolved.browser.screenshotFailures = false
  }
  else {
    resolved.browser.screenshotFailures ??= !isPreview && !resolved.browser.ui
  }

  resolved.browser.viewport ??= {} as any
  resolved.browser.viewport.width ??= 414
  resolved.browser.viewport.height ??= 896

  resolved.browser.locators ??= {} as any
  resolved.browser.locators.testIdAttribute ??= 'data-testid'

  if (resolved.browser.enabled && stdProvider === 'stackblitz') {
    resolved.browser.provider = 'preview'
  }

  resolved.browser.api = resolveApiServerConfig(
    resolved.browser,
    defaultBrowserPort,
  ) || {
    port: defaultBrowserPort,
  }

  // enable includeTaskLocation by default in UI mode
  if (resolved.browser.enabled) {
    if (resolved.browser.ui) {
      resolved.includeTaskLocation ??= true
    }
  }
  else if (resolved.ui) {
    resolved.includeTaskLocation ??= true
  }

  const htmlReporter = toArray(resolved.reporters).some((reporter) => {
    if (Array.isArray(reporter)) {
      return reporter[0] === 'html'
    }

    return false
  })

  if (htmlReporter) {
    resolved.includeTaskLocation ??= true
  }

  resolved.testTransformMode ??= {}

  resolved.testTimeout ??= resolved.browser.enabled ? 15000 : 5000
  resolved.hookTimeout ??= resolved.browser.enabled ? 30000 : 10000

  return resolved
}

export function isBrowserEnabled(config: ResolvedConfig): boolean {
  return Boolean(config.browser?.enabled)
}

export function resolveCoverageReporters(configReporters: NonNullable<BaseCoverageOptions['reporter']>): CoverageReporterWithOptions[] {
  // E.g. { reporter: "html" }
  if (!Array.isArray(configReporters)) {
    return [[configReporters, {}]]
  }

  const resolvedReporters: CoverageReporterWithOptions[] = []

  for (const reporter of configReporters) {
    if (Array.isArray(reporter)) {
      // E.g. { reporter: [ ["html", { skipEmpty: true }], ["lcov"], ["json", { file: "map.json" }] ]}
      resolvedReporters.push([reporter[0], reporter[1] as Record<string, unknown> || {}])
    }
    else {
      // E.g. { reporter: ["html", "json"]}
      resolvedReporters.push([reporter, {}])
    }
  }

  return resolvedReporters
}

function isPlaywrightChromiumOnly(vitest: Vitest, config: ResolvedConfig) {
  const browser = config.browser
  if (!browser || browser.provider !== 'playwright' || !browser.enabled) {
    return false
  }
  if (browser.name) {
    return browser.name === 'chromium'
  }
  if (!browser.instances) {
    return false
  }
  for (const instance of browser.instances) {
    const name = instance.name || (config.name ? `${config.name} (${instance.browser})` : instance.browser)
    // browser config is filtered out
    if (!vitest._matchesProjectFilter(name)) {
      continue
    }
    if (instance.browser !== 'chromium') {
      return false
    }
  }
  return true
}
