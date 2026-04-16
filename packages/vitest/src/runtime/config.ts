import type { FakeTimerInstallOpts } from '@sinonjs/fake-timers'
import type { PrettyFormatOptions } from '@vitest/pretty-format'
import type { SequenceHooks, VitestRunnerConfig } from '@vitest/runner'
import type { SnapshotEnvironment, SnapshotUpdateState } from '@vitest/snapshot'
import type { SerializedDiffOptions } from '@vitest/utils/diff'
import type { LabelColor } from '../types/general'

/**
 * Config that tests have access to.
 */
export interface SerializedConfig extends VitestRunnerConfig {
  color?: LabelColor
  globals: boolean
  base: string | undefined
  snapshotEnvironment?: string
  disableConsoleIntercept: boolean | undefined
  runner: string | undefined
  isolate: boolean
  maxWorkers: number
  bail: number | undefined
  environmentOptions?: Record<string, any>
  clearMocks: boolean
  mockReset: boolean
  restoreMocks: boolean
  unstubGlobals: boolean
  unstubEnvs: boolean
  // TODO: make optional
  fakeTimers: FakeTimerInstallOpts
  defines: Record<string, any>
  expect: {
    requireAssertions?: boolean
    poll?: {
      timeout?: number
      interval?: number
    }
  }
  printConsoleTrace: boolean | undefined
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
      exact: boolean
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
    enabled: boolean
    retainSamples: boolean
  }
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
  slowTestThreshold: number | undefined
  isAgent: boolean
}

export interface SerializedCoverageConfig {
  provider: 'istanbul' | 'v8' | 'custom' | undefined
  reportsDirectory: string
  htmlDir: string | undefined
  enabled: boolean
  customProviderModule: string | undefined
}

export interface SerializedRootConfig extends SerializedConfig {
  projects: SerializedConfig[]
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
