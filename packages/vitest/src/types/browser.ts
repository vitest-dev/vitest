import type { Awaitable } from '@vitest/utils'
import type { Vitest } from '../node'
import type { ProcessPool } from '../node/pool'
import type { ApiConfig } from './config'

export interface BrowserProvider {
  initialize(ctx: Vitest): Awaitable<void>
  createPool(): ProcessPool
  testFinished?(testId: string): Awaitable<void>
}

export interface BrowserProviderModule {
  new (): BrowserProvider
}

export interface BrowserConfigOptions {
  /**
   * if running tests in the broweser should be the default
   *
   * @default false
   */
  enabled?: boolean

  /**
   * Name of the browser
   *
   * @default tries to find the first available browser
   */
  name?: 'firefox' | 'chrome' | 'edge' | 'safari'

  /**
   * browser provider
   *
   * @default 'webdriver'
   */
  provider?: string

  /**
   * enable headless mode
   *
   * @default process.env.CI
   */
  headless?: boolean

  /**
   * Serve API options.
   *
   * The default port is 63315.
   */
  api?: ApiConfig | number
}

export interface ResolvedBrowserOptions extends BrowserConfigOptions {
  enabled: boolean
  headless: boolean
  api: ApiConfig
}
