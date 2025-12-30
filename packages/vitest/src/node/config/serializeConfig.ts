import type { TestProject } from '../project'
import type { SerializedConfig } from '../types/config'

export function serializeConfig(project: TestProject): SerializedConfig {
  const { config, globalConfig } = project
  const viteConfig = project._vite?.config
  const optimizer = config.deps?.optimizer || {}

  return {
    // TODO: remove functions from environmentOptions
    environmentOptions: config.environmentOptions,
    mode: config.mode,
    isolate: config.isolate,
    maxWorkers: config.maxWorkers,
    base: config.base,
    logHeapUsage: config.logHeapUsage,
    runner: config.runner,
    bail: config.bail,
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
    deps: {
      web: config.deps.web || {},
      optimizer: Object.entries(optimizer).reduce((acc, [name, option]) => {
        acc[name] = { enabled: option?.enabled ?? false }
        return acc
      }, {} as Record<string, { enabled: boolean }>),
      interopDefault: config.deps.interopDefault,
      moduleDirectories: config.deps.moduleDirectories,
    },
    snapshotOptions: {
      // TODO: store it differently, not on the config
      snapshotEnvironment: undefined!,
      updateSnapshot: globalConfig.snapshotOptions.updateSnapshot,
      snapshotFormat: {
        ...globalConfig.snapshotOptions.snapshotFormat,
      },
      expand:
        config.snapshotOptions.expand
        ?? globalConfig.snapshotOptions.expand,
    },
    sequence: {
      shuffle: globalConfig.sequence.shuffle,
      concurrent: globalConfig.sequence.concurrent,
      seed: globalConfig.sequence.seed,
      hooks: globalConfig.sequence.hooks,
      setupFiles: globalConfig.sequence.setupFiles,
    },
    inspect: globalConfig.inspect,
    inspectBrk: globalConfig.inspectBrk,
    inspector: globalConfig.inspector,
    watch: config.watch,
    includeTaskLocation:
      config.includeTaskLocation
      ?? globalConfig.includeTaskLocation,
    includeImportDurations:
      config.includeImportDurations
      ?? globalConfig.includeImportDurations,
    env: {
      ...viteConfig?.env,
      ...config.env,
    },
    browser: ((browser) => {
      const provider = project.browser?.provider
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
        providerOptions: provider?.name === 'playwright'
          ? {
              actionTimeout: (provider as any)?.options?.actionTimeout,
            }
          : {},
        trackUnhandledErrors: browser.trackUnhandledErrors ?? true,
        trace: browser.trace.mode,
      }
    })(config.browser),
    standalone: config.standalone,
    printConsoleTrace:
      config.printConsoleTrace ?? globalConfig.printConsoleTrace,
    benchmark: config.benchmark && {
      includeSamples: config.benchmark.includeSamples,
    },
    // the browser initialized them via `@vite/env` import
    serializedDefines: config.browser.enabled
      ? ''
      : project._serializedDefines || '',
    experimental: {
      fsModuleCache: config.experimental.fsModuleCache ?? false,
      printImportBreakdown: config.experimental.printImportBreakdown,
      openTelemetry: config.experimental.openTelemetry,
    },
  }
}
