import type { Awaitable } from '@vitest/utils'
import type { WorkspaceProject } from '../node/workspace'
import type { ApiConfig } from './config'

export interface BrowserProviderInitializationOptions {
  browser: string
  options?: BrowserProviderOptions
}

export interface BrowserProvider {
  name: string
  getSupportedBrowsers(): readonly string[]
  initialize(ctx: WorkspaceProject, options: BrowserProviderInitializationOptions): Awaitable<void>
  openPage(url: string): Awaitable<void>
  catchError(cb: (error: Error) => Awaitable<void>): () => Awaitable<void>
  close(): Awaitable<void>
}

export interface BrowserProviderModule {
  new (): BrowserProvider
}

export interface BrowserProviderOptions {}

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
   * Browser provider
   *
   * @default 'webdriverio'
   */
  provider?: 'webdriverio' | 'playwright' | 'none' | (string & {})

  /**
   * Options that are passed down to a browser provider.
   * To support type hinting, add one of the types to your tsconfig.json "compilerOptions.types" field:
   *
   * - for webdriverio: `@vitest/browser/providers/webdriverio`
   * - for playwright: `@vitest/browser/providers/playwright`
   *
   * @example
   * { playwright: { launch: { devtools: true } }
   */
  providerOptions?: BrowserProviderOptions

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
   * Update ESM imports so they can be spied/stubbed with vi.spyOn.
   * Enabled by default when running in browser.
   *
   * @default false
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
