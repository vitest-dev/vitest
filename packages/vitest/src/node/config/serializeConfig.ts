import type { ResolvedConfig as ViteConfig } from 'vite'
import type { ResolvedConfig, SerializedConfig } from '../types/config'

export function serializeConfig(
  config: ResolvedConfig,
  coreConfig: ResolvedConfig,
  viteConfig: ViteConfig | undefined,
): SerializedConfig {
  const optimizer = config.deps?.optimizer
  const poolOptions = config.poolOptions

  // Resolve from server.config to avoid comparing against default value
  const isolate = viteConfig?.test?.isolate

  return {
    // TODO: remove functions from environmentOptions
    environmentOptions: config.environmentOptions,
    mode: config.mode,
    isolate: config.isolate,
    base: config.base,
    logHeapUsage: config.logHeapUsage,
    runner: config.runner,
    bail: config.bail,
    preloads: config.preloads || [],
    defines: config.defines,
    chaiConfig: config.chaiConfig,
    setupFiles: config.setupFiles,
    allowOnly: config.allowOnly,
    testTimeout: config.testTimeout,
    testNamePattern: config.testNamePattern,
    hookTimeout: config.hookTimeout,
    clearMocks: config.clearMocks,
    mockReset: config.mockReset,
    restoreMocks: config.restoreMocks,
    unstubEnvs: config.unstubEnvs,
    unstubGlobals: config.unstubGlobals,
    maxConcurrency: config.maxConcurrency,
    pool: config.pool,
    expect: config.expect,
    snapshotSerializers: config.snapshotSerializers,
    // TODO: non serializable function?
    diff: config.diff,
    retry: config.retry,
    disableConsoleIntercept: config.disableConsoleIntercept,
    root: config.root,
    name: config.name,
    globals: config.globals,
    snapshotEnvironment: config.snapshotEnvironment,
    passWithNoTests: config.passWithNoTests,
    coverage: ((coverage) => {
      const htmlReporter = coverage.reporter.find(([reporterName]) => reporterName === 'html') as [
        'html',
        { subdir?: string },
      ] | undefined
      const subdir = htmlReporter && htmlReporter[1]?.subdir
      return {
        reportsDirectory: coverage.reportsDirectory,
        provider: coverage.provider,
        enabled: coverage.enabled,
        htmlReporter: htmlReporter
          ? { subdir }
          : undefined,
        customProviderModule: 'customProviderModule' in coverage
          ? coverage.customProviderModule
          : undefined,
      }
    })(config.coverage),
    fakeTimers: config.fakeTimers,
    poolOptions: {
      forks: {
        singleFork:
          poolOptions?.forks?.singleFork
          ?? coreConfig.poolOptions?.forks?.singleFork
          ?? false,
        isolate:
          poolOptions?.forks?.isolate
          ?? isolate
          ?? coreConfig.poolOptions?.forks?.isolate
          ?? true,
      },
      threads: {
        singleThread:
          poolOptions?.threads?.singleThread
          ?? coreConfig.poolOptions?.threads?.singleThread
          ?? false,
        isolate:
          poolOptions?.threads?.isolate
          ?? isolate
          ?? coreConfig.poolOptions?.threads?.isolate
          ?? true,
      },
      vmThreads: {
        singleThread:
          poolOptions?.vmThreads?.singleThread
          ?? coreConfig.poolOptions?.vmThreads?.singleThread
          ?? false,
      },
      vmForks: {
        singleFork:
          poolOptions?.vmForks?.singleFork
          ?? coreConfig.poolOptions?.vmForks?.singleFork
          ?? false,
      },
    },
    deps: {
      web: config.deps.web || {},
      optimizer: {
        web: {
          enabled: optimizer?.web?.enabled ?? true,
        },
        ssr: {
          enabled: optimizer?.ssr?.enabled ?? true,
        },
      },
      interopDefault: config.deps.interopDefault,
      moduleDirectories: config.deps.moduleDirectories,
    },
    snapshotOptions: {
      // TODO: store it differently, not on the config
      snapshotEnvironment: undefined!,
      updateSnapshot: coreConfig.snapshotOptions.updateSnapshot,
      snapshotFormat: {
        ...coreConfig.snapshotOptions.snapshotFormat,
        compareKeys: undefined,
      },
      expand:
        config.snapshotOptions.expand
        ?? coreConfig.snapshotOptions.expand,
    },
    sequence: {
      shuffle: coreConfig.sequence.shuffle,
      concurrent: coreConfig.sequence.concurrent,
      seed: coreConfig.sequence.seed,
      hooks: coreConfig.sequence.hooks,
      setupFiles: coreConfig.sequence.setupFiles,
    },
    inspect: coreConfig.inspect,
    inspectBrk: coreConfig.inspectBrk,
    inspector: coreConfig.inspector,
    watch: config.watch,
    includeTaskLocation:
      config.includeTaskLocation
      ?? coreConfig.includeTaskLocation,
    env: {
      ...viteConfig?.env,
      ...config.env,
    },
    browser: ((browser) => {
      return {
        name: browser.name,
        headless: browser.headless,
        isolate: browser.isolate,
        fileParallelism: browser.fileParallelism,
        ui: browser.ui,
        viewport: browser.viewport,
        screenshotFailures: browser.screenshotFailures,
        locators: {
          testIdAttribute: browser.locators.testIdAttribute,
        },
      }
    })(config.browser),
    standalone: config.standalone,
    printConsoleTrace:
      config.printConsoleTrace ?? coreConfig.printConsoleTrace,
    benchmark: config.benchmark && {
      includeSamples: config.benchmark.includeSamples,
    },
  }
}
