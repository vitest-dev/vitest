import type { FakeTimerInstallOpts } from '@sinonjs/fake-timers'
import type { PrettyFormatOptions } from '@vitest/pretty-format'
import type { SequenceHooks, SequenceSetupFiles, SerializableRetry, TestTagDefinition } from '@vitest/runner'
import type { SnapshotEnvironment, SnapshotUpdateState } from '@vitest/snapshot'
import type { SerializedDiffOptions } from '@vitest/utils/diff'

/**
 * Config that tests have access to.
 */
export interface SerializedConfig {
  name: string | undefined
  globals: boolean
  base: string | undefined
  snapshotEnvironment?: string
  disableConsoleIntercept: boolean | undefined
  runner: string | undefined
  isolate: boolean
  maxWorkers: number
  mode: 'test' | 'benchmark'
  bail: number | undefined
  environmentOptions?: Record<string, any>
  root: string
  setupFiles: string[]
  passWithNoTests: boolean
  testNamePattern: RegExp | undefined
  allowOnly: boolean
  testTimeout: number
  hookTimeout: number
  clearMocks: boolean
  mockReset: boolean
  restoreMocks: boolean
  unstubGlobals: boolean
  unstubEnvs: boolean
  // TODO: make optional
  fakeTimers: FakeTimerInstallOpts
  maxConcurrency: number
  defines: Record<string, any>
  expect: {
    requireAssertions?: boolean
    poll?: {
      timeout?: number
      interval?: number
    }
  }
  printConsoleTrace: boolean | undefined
  sequence: {
    shuffle?: boolean
    concurrent?: boolean
    seed: number
    hooks: SequenceHooks
    setupFiles: SequenceSetupFiles
  }
  deps: {
    web: {
      transformAssets?: boolean
      transformCss?: boolean
      transformGlobPattern?: RegExp | RegExp[]
    }
    optimizer: Record<string, { enabled: boolean }>
    interopDefault: boolean | undefined
    moduleDirectories: string[] | undefined
  }
  snapshotOptions: {
    updateSnapshot: SnapshotUpdateState
    expand: boolean | undefined
    snapshotFormat: PrettyFormatOptions | undefined
    /**
     * only exists for tests, not available in the main process
     */
    snapshotEnvironment: SnapshotEnvironment
  }
  pool: string
  snapshotSerializers: string[]
  chaiConfig: {
    includeStack?: boolean
    showDiff?: boolean
    truncateThreshold?: number
  } | undefined
  api: {
    allowExec: boolean | undefined
    allowWrite: boolean | undefined
  }
  diff: string | SerializedDiffOptions | undefined
  retry: SerializableRetry
  includeTaskLocation: boolean | undefined
  inspect: boolean | string | undefined
  inspectBrk: boolean | string | undefined
  inspector: {
    enabled?: boolean
    port?: number
    host?: string
    waitForDebugger?: boolean
  }
  watch: boolean
  env: Record<string, any>
  browser: {
    name: string
    headless: boolean
    isolate: boolean
    fileParallelism: boolean
    ui: boolean
    viewport: {
      width: number
      height: number
    }
    locators: {
      testIdAttribute: string
    }
    screenshotFailures: boolean
    providerOptions: {
      // for playwright
      actionTimeout?: number
    }
    trace: BrowserTraceViewMode
    trackUnhandledErrors: boolean
    detailsPanelPosition: 'right' | 'bottom'
  }
  standalone: boolean
  logHeapUsage: boolean | undefined
  detectAsyncLeaks: boolean
  coverage: SerializedCoverageConfig
  benchmark: {
    includeSamples: boolean
  } | undefined
  serializedDefines: string
  experimental: {
    fsModuleCache: boolean
    importDurations: {
      print: boolean | 'on-warn'
      limit: number
      failOnDanger: boolean
      thresholds: {
        warn: number
        danger: number
      }
    }
    viteModuleRunner: boolean
    nodeLoader: boolean
    openTelemetry: {
      enabled: boolean
      sdkPath?: string
      browserSdkPath?: string
    } | undefined
  }
  tags: TestTagDefinition[]
  tagsFilter: string[] | undefined
  strictTags: boolean
  slowTestThreshold: number | undefined
}

export interface SerializedCoverageConfig {
  provider: 'istanbul' | 'v8' | 'custom' | undefined
  reportsDirectory: string
  htmlDir: string | undefined
  enabled: boolean
  customProviderModule: string | undefined
}

export type RuntimeConfig = Pick<
  SerializedConfig,
  | 'allowOnly'
  | 'testTimeout'
  | 'hookTimeout'
  | 'clearMocks'
  | 'mockReset'
  | 'restoreMocks'
  | 'fakeTimers'
  | 'maxConcurrency'
  | 'expect'
  | 'printConsoleTrace'
> & {
  sequence?: {
    hooks?: SequenceHooks
  }
}

export type RuntimeOptions = Partial<RuntimeConfig>
export type BrowserTraceViewMode = 'on' | 'off' | 'on-first-retry' | 'on-all-retries' | 'retain-on-failure'
