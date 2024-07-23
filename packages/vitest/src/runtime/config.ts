import type { FakeTimerInstallOpts } from '@sinonjs/fake-timers'
import type { SequenceHooks } from '@vitest/runner'

/**
 * Config that tests have access to.
 */
export interface SerialisableConfig {
  name?: string
  allowOnly: boolean
  testTimeout: number
  hookTimeout: number
  clearMocks: boolean
  mockReset: boolean
  restoreMocks: boolean
  unstubGlobals: boolean
  unstubEnvs: boolean
  fakeTimers?: FakeTimerInstallOpts
  maxConcurrency: number
  expect: {
    requireAssertions?: boolean
    poll?: {
      timeout?: number
      interval?: number
    }
  }
  printConsoleTrace?: boolean
  sequence: {
    shuffle?:
      | boolean
      | {
        files?: boolean
        tests?: boolean
      }
    concurrent?: boolean
    hooks: SequenceHooks
  }
}

export type RuntimeConfig = Pick<
  SerialisableConfig,
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
    concurrent?: boolean
    hooks?: SequenceHooks
  }
}
