import type { FakeTimerInstallOpts } from '@sinonjs/fake-timers'
import type { PrettyFormatOptions } from '@vitest/pretty-format'
import type { SequenceHooks, SequenceSetupFiles } from '@vitest/runner'
import type { SnapshotUpdateState } from '@vitest/snapshot'
import type { SnapshotEnvironment } from '@vitest/snapshot/environment'
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
  mode: 'test' | 'benchmark'
  bail: number | undefined
  preloads: string[]
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
  poolOptions: {
    forks: {
      singleFork: boolean
      isolate: boolean
    }
    threads: {
      singleThread: boolean
      isolate: boolean
    }
    vmThreads: {
      singleThread: boolean
    }
    vmForks: {
      singleFork: boolean
    }
  }
  deps: {
    web: {
      transformAssets?: boolean
      transformCss?: boolean
      transformGlobPattern?: RegExp | RegExp[]
    }
    optimizer: {
      web: {
        enabled: boolean
      }
      ssr: {
        enabled: boolean
      }
    }
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
  diff: string | SerializedDiffOptions | undefined
  retry: number
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
  }
  standalone: boolean
  logHeapUsage: boolean | undefined
  coverage: SerializedCoverageConfig
  benchmark?: {
    includeSamples: boolean
  }
}

export interface SerializedCoverageConfig {
  provider: 'istanbul' | 'v8' | 'custom' | undefined
  reportsDirectory: string
  htmlReporter: {
    subdir: string | undefined
  } | undefined
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
