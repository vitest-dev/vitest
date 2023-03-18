import type { Awaitable } from '@vitest/utils'
import type { Vitest } from '../node'
import type { ProcessPool } from '../node/pool'

export interface BrowserProvider {
  initialize?(ctx: Vitest): Awaitable<void>
  createPool?(): ProcessPool
  testFinished?(testId: string): Awaitable<void>
}

export interface BrowserProviderModule {
  new (): BrowserProvider
}

export interface BrowserConfigOptions {
  /**
   * browser provider
   * @experimental
   *
   * @default 'webdriver'
   */
  provider?: string

  /**
   * headless mode for the browser mode
   * @experimental
   *
   * @default process.env.CI
   */
  headless?: boolean
}
