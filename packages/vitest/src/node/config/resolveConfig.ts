import type { ResolvedConfig as ResolvedViteConfig } from 'vite'
import type { Vitest } from '../core'
import type { Logger } from '../logger'
import type { BenchmarkBuiltinReporters } from '../reporters'
import type { ResolvedBrowserOptions } from '../types/browser'
import type {
  ApiConfig,
  ResolvedConfig,
  UserConfig,
} from '../types/config'
import type { BaseCoverageOptions, CoverageReporterWithOptions } from '../types/coverage'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { slash, toArray } from '@vitest/utils/helpers'
import { resolveModule } from 'local-pkg'
import { normalize, relative, resolve } from 'pathe'
import c from 'tinyrainbow'
import { mergeConfig } from 'vite'
import {
  configFiles,
  defaultBrowserPort,
  defaultInspectPort,
  defaultPort,
} from '../../constants'
import { benchmarkConfigDefaults, configDefaults } from '../../defaults'
import { isCI, stdProvider } from '../../utils/env'
import { getWorkersCountByPercentage } from '../../utils/workers'
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

/**
 * @deprecated Internal function
 */
export function resolveApiServerConfig<Options extends ApiConfig & Omit<UserConfig, 'expect'>>(
  options: Options,
  defaultPort: number,
  parentApi?: ApiConfig,
  logger?: Logger,
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

  // if the API server is exposed to network, disable write operations by default
  if (!api.middlewareMode && api.host && api.host !== 'localhost' && api.host !== '127.0.0.1') {
    // assigned to browser
    if (parentApi) {
      if (api.allowWrite == null && api.allowExec == null) {
        logger?.error(
          c.yellow(
            `${c.yellowBright(' WARNING ')} API server is exposed to network, disabling write and exec operations by default for security reasons. This can cause some APIs to not work as expected. Set \`browser.api.allowExec\` manually to hide this warning. See https://vitest.dev/config/browser/api for more details.`,
          ),
        )
      }
    }
    api.allowWrite ??= parentApi?.allowWrite ?? false
    api.allowExec ??= parentApi?.allowExec ?? false
  }
  else {
    api.allowWrite ??= parentApi?.allowWrite ?? true
    api.allowExec ??= parentApi?.allowExec ?? true
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

  if (resolved.retry && typeof resolved.retry === 'object' && typeof resolved.retry.condition === 'function') {
    logger.console.warn(
      c.yellow('Warning: retry.condition function cannot be used inside a config file. '
        + 'Use a RegExp pattern instead, or define the function in your test file.'),
    )

    resolved.retry = {
      ...resolved.retry,
      condition: undefined,
    }
  }

  if (options.pool && typeof options.pool !== 'string') {
    resolved.pool = options.pool.name
    resolved.poolRunner = options.pool
  }

  if ('poolOptions' in resolved) {
    logger.deprecate('`test.poolOptions` was removed in Vitest 4. All previous `poolOptions` are now top-level options. Please, refer to the migration guide: https://vitest.dev/guide/migration#pool-rework')
  }

  resolved.pool ??= 'forks'

  resolved.project = toArray(resolved.project)
  resolved.provide ??= {}

  // shallow copy tags array to avoid mutating user config
  resolved.tags = [...resolved.tags || []]
  const definedTags = new Set<string>()
  resolved.tags.forEach((tag) => {
    if (!tag.name || typeof tag.name !== 'string') {
      throw new Error(`Each tag defined in "test.tags" must have a "name" property, received: ${JSON.stringify(tag)}`)
    }
    if (definedTags.has(tag.name)) {
      throw new Error(`Tag name "${tag.name}" is already defined in "test.tags". Tag names must be unique.`)
    }
    if (tag.name.match(/\s/)) {
      throw new Error(`Tag name "${tag.name}" is invalid. Tag names cannot contain spaces.`)
    }
    if (tag.name.match(/([!()*|&])/)) {
      throw new Error(`Tag name "${tag.name}" is invalid. Tag names cannot contain "!", "*", "&", "|", "(", or ")".`)
    }
    if (tag.name.match(/^\s*(and|or|not)\s*$/i)) {
      throw new Error(`Tag name "${tag.name}" is invalid. Tag names cannot be a logical operator like "and", "or", "not".`)
    }
    if (typeof tag.retry === 'object' && typeof tag.retry.condition === 'function') {
      throw new TypeError(`Tag "${tag.name}": retry.condition function cannot be used inside a config file. Use a RegExp pattern instead, or define the function in your test file.`)
    }
    if (tag.priority != null && (typeof tag.priority !== 'number' || tag.priority < 0)) {
      throw new TypeError(`Tag "${tag.name}": priority must be a non-negative number.`)
    }
    definedTags.add(tag.name)
  })

  resolved.name = typeof options.name === 'string'
    ? options.name
    : (options.name?.label || '')

  resolved.color = typeof options.name !== 'string' ? options.name?.color : undefined

  if (resolved.environment === 'browser') {
    throw new Error(`Looks like you set "test.environment" to "browser". To enable Browser Mode, use "test.browser.enabled" instead.`)
  }

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

  // run benchmark sequentially by default
  const fileParallelism = options.fileParallelism ?? mode !== 'benchmark'

  if (!fileParallelism) {
    // ignore user config, parallelism cannot be implemented without limiting workers
    resolved.maxWorkers = 1
  }

  if (resolved.maxConcurrency === 0) {
    logger.console.warn(
      c.yellow(`The option "maxConcurrency" cannot be set to 0. Using default value ${configDefaults.maxConcurrency} instead.`),
    )
    resolved.maxConcurrency = configDefaults.maxConcurrency
  }

  if (resolved.inspect || resolved.inspectBrk) {
    if (resolved.maxWorkers !== 1) {
      const inspectOption = `--inspect${resolved.inspectBrk ? '-brk' : ''}`
      throw new Error(
        `You cannot use ${inspectOption} without "--no-file-parallelism"`,
      )
    }
  }

  // apply browser CLI options only if the config already has the browser config and not disabled manually
  if (
    vitest._cliOptions.browser
    && resolved.browser
    // if enabled is set to `false`, but CLI overrides it, then always override it
    && (resolved.browser.enabled !== false || vitest._cliOptions.browser.enabled)
  ) {
    resolved.browser = mergeConfig(
      resolved.browser,
      vitest._cliOptions.browser,
    ) as ResolvedBrowserOptions
  }

  resolved.browser ??= {} as any
  const browser = resolved.browser

  if (browser.enabled) {
    const instances = browser.instances
    if (!browser.instances) {
      browser.instances = []
    }

    // use `chromium` by default when the preview provider is specified
    // for a smoother experience. if chromium is not available, it will
    // open the default browser anyway
    if (!browser.instances.length && browser.provider?.name === 'preview') {
      browser.instances = [{ browser: 'chromium' }]
    }

    if (browser.name && instances?.length) {
      // --browser=chromium filters configs to a single one
      browser.instances = browser.instances.filter(instance => instance.browser === browser.name)

      // if `instances` were defined, but now they are empty,
      // let's throw an error because the filter is invalid
      if (!browser.instances.length) {
        throw new Error([
          `"browser.instances" was set in the config, but the array is empty. Define at least one browser config.`,
          ` The "browser.name" was set to "${browser.name}" which filtered all configs (${instances.map(c => c.browser).join(', ')}). Did you mean to use another name?`,
        ].join(''))
      }
    }
  }

  if (resolved.coverage.enabled && resolved.coverage.provider === 'istanbul' && resolved.experimental?.viteModuleRunner === false) {
    throw new Error(`"Istanbul" coverage provider is not compatible with "experimental.viteModuleRunner: false". Please, enable "viteModuleRunner" or switch to "v8" coverage provider.`)
  }

  if (browser.enabled && resolved.detectAsyncLeaks) {
    logger.console.warn(c.yellow('The option "detectAsyncLeaks" is not supported in browser mode and will be ignored.'))
  }

  const containsChromium = hasBrowserChromium(vitest, resolved)
  const hasOnlyChromium = hasOnlyBrowserChromium(vitest, resolved)

  // Browser-mode "Chromium" only features:
  if (browser.enabled && (!containsChromium || !hasOnlyChromium)) {
    const browserConfig = `
{
  browser: {
    provider: ${browser.provider?.name || 'preview'}(),
    instances: [
      ${(browser.instances || []).map(i => `{ browser: '${i.browser}' }`).join(',\n      ')}
    ],
  },
}
    `.trim()

    const preferredProvider = (!browser.provider?.name || browser.provider.name === 'preview')
      ? 'playwright'
      : browser.provider.name
    const preferredBrowser = preferredProvider === 'playwright' ? 'chromium' : 'chrome'
    const correctExample = `
{
  browser: {
    provider: ${preferredProvider}(),
    instances: [
      { browser: '${preferredBrowser}' }
    ],
  },
}
    `.trim()

    // requires all projects to be chromium
    if (!hasOnlyChromium && resolved.coverage.enabled && resolved.coverage.provider === 'v8') {
      const coverageExample = `
{
  coverage: {
    provider: 'istanbul',
  },
}
      `.trim()

      throw new Error(
        `@vitest/coverage-v8 does not work with\n${browserConfig}\n`
        + `\nUse either:\n${correctExample}`
        + `\n\n...or change your coverage provider to:\n${coverageExample}\n`,
      )
    }

    // ignores non-chromium browsers when there is at least one chromium project
    if (!containsChromium && (resolved.inspect || resolved.inspectBrk)) {
      const inspectOption = `--inspect${resolved.inspectBrk ? '-brk' : ''}`

      throw new Error(
        `${inspectOption} does not work with\n${browserConfig}\n`
        + `\nUse either:\n${correctExample}`
        + `\n\n...or disable ${inspectOption}\n`,
      )
    }
  }

  resolved.coverage.reporter = resolveCoverageReporters(resolved.coverage.reporter)
  if (resolved.coverage.changed === undefined && resolved.changed !== undefined) {
    resolved.coverage.changed = resolved.changed
  }

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

    if (resolved.coverage.htmlDir) {
      resolved.coverage.htmlDir = resolve(
        resolved.root,
        resolved.coverage.htmlDir,
      )
    }

    // infer default htmlDir based on builtin reporter's html output location
    if (!resolved.coverage.htmlDir) {
      const htmlReporter = resolved.coverage.reporter.find(([name]) => name === 'html' || name === 'html-spa')
      if (htmlReporter) {
        const [, options] = htmlReporter
        const subdir = options && typeof options === 'object' && 'subdir' in options && typeof options.subdir === 'string'
          ? options.subdir
          : undefined
        resolved.coverage.htmlDir = resolve(reportsDirectory, subdir || '.')
      }
      else {
        const lcovReporter = resolved.coverage.reporter.find(([name]) => name === 'lcov')
        if (lcovReporter) {
          resolved.coverage.htmlDir = resolve(reportsDirectory, 'lcov-report')
        }
      }
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

  resolved.deps.optimizer ??= {}
  resolved.deps.optimizer.ssr ??= {}
  resolved.deps.optimizer.ssr.enabled ??= false
  resolved.deps.optimizer.client ??= {}
  resolved.deps.optimizer.client.enabled ??= false

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

  // Add hard-coded default coverage exclusions. These cannot be overidden by user config.
  // Override original exclude array for cases where user re-uses same object in test.exclude.
  resolved.coverage.exclude = [
    ...resolved.coverage.exclude,

    // Exclude setup files
    ...resolved.setupFiles.map(
      file =>
        `${resolved.coverage.allowExternal ? '**/' : ''}${relative(
          resolved.root,
          file,
        )}`,
    ),

    // Exclude test files
    ...resolved.include,

    // Configs
    resolved.config && slash(resolved.config),
    ...configFiles,

    // Vite internal
    '**\/virtual:*',
    '**\/__x00__*',

    '**/node_modules/**',
  ].filter(pattern => typeof pattern === 'string')

  resolved.forceRerunTriggers = [
    ...resolved.forceRerunTriggers,
    ...resolved.setupFiles,
  ]

  if (resolved.cliExclude) {
    resolved.exclude.push(...resolved.cliExclude)
  }

  if (resolved.runner) {
    resolved.runner = resolvePath(resolved.runner, resolved.root)
  }

  resolved.attachmentsDir = resolve(
    resolved.root,
    resolved.attachmentsDir ?? '.vitest-attachments',
  )

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
    // TODO: support it via separate config (like DiffOptions) or via `Function.toString()`
    if (typeof resolved.snapshotFormat.compareKeys === 'function') {
      throw new TypeError(`"snapshotFormat.compareKeys" function is not supported.`)
    }
  }

  const UPDATE_SNAPSHOT = resolved.update || process.env.UPDATE_SNAPSHOT
  resolved.snapshotOptions = {
    expand: resolved.expandSnapshotDiff ?? false,
    snapshotFormat: resolved.snapshotFormat || {},
    updateSnapshot:
      UPDATE_SNAPSHOT === 'all' || UPDATE_SNAPSHOT === 'new' || UPDATE_SNAPSHOT === 'none'
        ? UPDATE_SNAPSHOT
        : isCI && !UPDATE_SNAPSHOT ? 'none' : UPDATE_SNAPSHOT ? 'all' : 'new',
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

  resolved.execArgv ??= []
  resolved.pool ??= 'threads'

  if (
    resolved.pool === 'vmForks'
    || resolved.pool === 'vmThreads'
    || resolved.pool === 'typescript'
  ) {
    resolved.isolate = false
  }

  if (process.env.VITEST_MAX_WORKERS) {
    resolved.maxWorkers = Number.parseInt(process.env.VITEST_MAX_WORKERS)
  }

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
  resolved.api = { ...api, token: __VITEST_GENERATE_UI_TOKEN__ ? crypto.randomUUID() : '0' }

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
      // When CLI reporters are specified, preserve options from config file
      const configReportersMap = new Map<string, Record<string, unknown>>()

      // Build a map of reporter names to their options from the config
      for (const reporter of resolved.reporters) {
        if (Array.isArray(reporter)) {
          const [reporterName, reporterOptions] = reporter
          if (typeof reporterName === 'string') {
            configReportersMap.set(reporterName, reporterOptions as Record<string, unknown>)
          }
        }
      }

      resolved.reporters = Array.from(new Set(toArray(cliReporters)))
        .filter(Boolean)
        .map(reporter => [reporter, configReportersMap.get(reporter) || {}])
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
    if (resolved.cache && typeof resolved.cache.dir === 'string') {
      vitest.logger.deprecate(
        `"cache.dir" is deprecated, use Vite's "cacheDir" instead if you want to change the cache director. Note caches will be written to "cacheDir\/vitest"`,
      )
    }

    resolved.cache = { dir: viteConfig.cacheDir }
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
  resolved.sequence.groupOrder ??= 0
  resolved.sequence.hooks ??= 'stack'
  // Set seed if either files or tests are shuffled
  if (resolved.sequence.sequencer === RandomSequencer || resolved.sequence.shuffle) {
    resolved.sequence.seed ??= Date.now()
  }

  resolved.typecheck = {
    ...configDefaults.typecheck,
    ...resolved.typecheck,
  }

  resolved.typecheck ??= {} as any
  resolved.typecheck.enabled ??= false

  if (resolved.typecheck.enabled) {
    logger.console.warn(
      c.yellow(
        'Testing types with tsc and vue-tsc is an experimental feature.\nBreaking changes might not follow SemVer, please pin Vitest\'s version when using it.',
      ),
    )
  }

  resolved.browser.enabled ??= false
  resolved.browser.headless ??= isCI
  if (resolved.browser.isolate) {
    logger.console.warn(
      c.yellow('`browser.isolate` is deprecated. Use top-level `isolate` instead.'),
    )
  }
  resolved.browser.isolate ??= resolved.isolate ?? true
  resolved.browser.fileParallelism
    ??= options.fileParallelism ?? mode !== 'benchmark'
  // disable in headless mode by default, and if CI is detected
  resolved.browser.ui ??= resolved.browser.headless === true ? false : !isCI
  resolved.browser.commands ??= {}
  resolved.browser.detailsPanelPosition ??= 'right'
  if (resolved.browser.screenshotDirectory) {
    resolved.browser.screenshotDirectory = resolve(
      resolved.root,
      resolved.browser.screenshotDirectory,
    )
  }

  if (resolved.inspector.enabled) {
    resolved.browser.trackUnhandledErrors ??= false
  }

  resolved.browser.viewport ??= {} as any
  resolved.browser.viewport.width ??= 414
  resolved.browser.viewport.height ??= 896

  resolved.browser.locators ??= {} as any
  resolved.browser.locators.testIdAttribute ??= 'data-testid'

  if (typeof resolved.browser.provider === 'string') {
    const source = `@vitest/browser-${resolved.browser.provider}`
    throw new TypeError(
      'The `browser.provider` configuration was changed to accept a factory instead of a string. '
      + `Add an import of "${resolved.browser.provider}" from "${source}" instead. See: https://vitest.dev/config/browser/provider`,
    )
  }

  const isPreview = resolved.browser.provider?.name === 'preview'

  if (!isPreview && resolved.browser.enabled && stdProvider === 'stackblitz') {
    throw new Error(`stackblitz environment does not support the ${resolved.browser.provider?.name} provider. Please, use "@vitest/browser-preview" instead.`)
  }
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
  if (resolved.browser.provider && resolved.browser.provider.options == null) {
    resolved.browser.provider.options = {}
  }

  resolved.browser.api = resolveApiServerConfig(
    resolved.browser,
    defaultBrowserPort,
    resolved.api,
    logger,
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

  if (typeof resolved.browser.trace === 'string' || !resolved.browser.trace) {
    resolved.browser.trace = { mode: resolved.browser.trace || 'off' }
  }
  if (resolved.browser.trace.tracesDir != null) {
    resolved.browser.trace.tracesDir = resolvePath(
      resolved.browser.trace.tracesDir,
      resolved.root,
    )
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

  resolved.server ??= {}
  resolved.server.deps ??= {}

  if (resolved.server.debug?.dump || process.env.VITEST_DEBUG_DUMP) {
    const userFolder = resolved.server.debug?.dump || process.env.VITEST_DEBUG_DUMP
    resolved.dumpDir = resolve(
      resolved.root,
      typeof userFolder === 'string' && userFolder !== 'true'
        ? userFolder
        : '.vitest-dump',
      resolved.name || 'root',
    )
  }

  resolved.testTimeout ??= resolved.browser.enabled ? 15_000 : 5_000
  resolved.hookTimeout ??= resolved.browser.enabled ? 30_000 : 10_000

  resolved.experimental ??= {} as any
  if (resolved.experimental.openTelemetry?.sdkPath) {
    const sdkPath = resolve(
      resolved.root,
      resolved.experimental.openTelemetry.sdkPath,
    )
    resolved.experimental.openTelemetry.sdkPath = pathToFileURL(sdkPath).toString()
  }
  if (resolved.experimental.openTelemetry?.browserSdkPath) {
    const browserSdkPath = resolve(
      resolved.root,
      resolved.experimental.openTelemetry.browserSdkPath,
    )
    resolved.experimental.openTelemetry.browserSdkPath = browserSdkPath
  }
  if (resolved.experimental.fsModuleCachePath) {
    resolved.experimental.fsModuleCachePath = resolve(
      resolved.root,
      resolved.experimental.fsModuleCachePath,
    )
  }
  resolved.experimental.importDurations ??= {} as any
  resolved.experimental.importDurations.print ??= false
  resolved.experimental.importDurations.failOnDanger ??= false
  if (resolved.experimental.importDurations.limit == null) {
    const shouldCollect
      = resolved.experimental.importDurations.print
        || resolved.experimental.importDurations.failOnDanger
        || resolved.ui
    resolved.experimental.importDurations.limit = shouldCollect ? 10 : 0
  }
  resolved.experimental.importDurations.thresholds ??= {} as any
  resolved.experimental.importDurations.thresholds.warn ??= 100
  resolved.experimental.importDurations.thresholds.danger ??= 500

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

function isChromiumName(provider: string, name: string) {
  if (provider === 'playwright') {
    return name === 'chromium'
  }
  return name === 'chrome' || name === 'edge'
}

function hasBrowserChromium(vitest: Vitest, config: ResolvedConfig) {
  const browser = config.browser
  if (!browser || !browser.provider || browser.provider.name === 'preview' || !browser.enabled) {
    return false
  }
  if (browser.name) {
    return isChromiumName(browser.provider.name, browser.name)
  }
  if (!browser.instances) {
    return false
  }
  return browser.instances.some((instance) => {
    const name = instance.name || (config.name ? `${config.name} (${instance.browser})` : instance.browser)
    // browser config is filtered out
    if (!vitest.matchesProjectFilter(name)) {
      return false
    }
    return isChromiumName(browser.provider!.name, instance.browser)
  })
}

function hasOnlyBrowserChromium(vitest: Vitest, config: ResolvedConfig) {
  const browser = config.browser
  if (!browser || !browser.provider || browser.provider.name === 'preview' || !browser.enabled) {
    return false
  }
  if (browser.name) {
    return isChromiumName(browser.provider.name, browser.name)
  }
  if (!browser.instances) {
    return false
  }
  return browser.instances.every((instance) => {
    const name = instance.name || (config.name ? `${config.name} (${instance.browser})` : instance.browser)
    // browser config is filtered out
    if (!vitest.matchesProjectFilter(name)) {
      return true // ignore this project
    }
    return isChromiumName(browser.provider!.name, instance.browser)
  })
}
