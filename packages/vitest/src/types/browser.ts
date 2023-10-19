import type { Awaitable } from '@vitest/utils'
import type { WorkspaceProject } from '../node/workspace'
import type { ApiConfig } from './config'

export interface BrowserProviderOptions {
  browser: string
}

export interface BrowserProvider {
  name: string
  getSupportedBrowsers(): readonly string[]
  initialize(ctx: WorkspaceProject, options: BrowserProviderOptions): Awaitable<void>
  isOpen(): boolean
  openPage(url: string): Awaitable<void>
  catchError(cb: (error: Error) => Awaitable<void>): () => Awaitable<void>
  close(): Awaitable<void>
}

export interface BrowserProviderModule {
  new (): BrowserProvider
}

export interface BrowserConfigOptions {
  /**
   * if running tests in the browser should be the default
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

  /**
   * When running on browser, enable this flag if your tests include some UI.
   *
   * The test's UI will be available in the `Browser UI` tab.
   *
   * @default false
   */
  enableUI?: boolean

  /**
   * Update ESM imports so they can be spied/stubbed with vi.spyOn.
   * Enabled by default when running in browser.
   *
   * @default true
   * @experimental
   */
  slowHijackESM?: boolean

  /**
   * Isolate test environment after each test
   *
   * @default true
   */
  isolate?: boolean
}

export interface ResolvedBrowserOptions extends BrowserConfigOptions {
  enabled: boolean
  headless: boolean
  isolate: boolean
  api: ApiConfig
}
