import type { Awaitable } from '@vitest/utils'
import type { Vitest } from '../node'
import type { ApiConfig } from './config'

export interface BrowserProviderOptions {
  browser: string
}

export interface BrowserProvider {
  name: string
  getSupportedBrowsers(): readonly string[]
  initialize(ctx: Vitest, options: BrowserProviderOptions): Awaitable<void>
  openPage(url: string): Awaitable<void>
  close(): Awaitable<void>
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
   */
  name: string

  /**
   * browser provider
   *
   * @default 'webdriverio'
   */
  provider?: 'webdriverio' | 'playwright' | (string & {})

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
