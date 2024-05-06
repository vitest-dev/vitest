import type { Awaitable } from '@vitest/utils'
import type { WorkspaceProject } from '../node/workspace'
import type { ApiConfig } from './config'

export interface BrowserProviderInitializationOptions {
  browser: string
  options?: BrowserProviderOptions
}

export interface BrowserProvider {
  name: string
  getSupportedBrowsers: () => readonly string[]
  openPage: (url: string) => Awaitable<void>
  close: () => Awaitable<void>
  // eslint-disable-next-line ts/method-signature-style -- we want to allow extended options
  initialize(
    ctx: WorkspaceProject,
    options: BrowserProviderInitializationOptions
  ): Awaitable<void>
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

  /**
   * Run test files in parallel. Fallbacks to `test.fileParallelism`.
   *
   * @default test.fileParallelism
   */
  fileParallelism?: boolean

  /**
   * Scripts injected into the tester iframe.
   */
  testerScripts?: BrowserScript[]

  /**
   * Scripts injected into the main window.
   */
  indexScripts?: BrowserScript[]
}

export interface BrowserScript {
  /**
   * If "content" is provided and type is "module", this will be its identifier.
   *
   * If you are using TypeScript, you can add `.ts` extension here for example.
   * @default `injected-${index}.js`
   */
  id?: string
  /**
   * JavaScript content to be injected. This string is processed by Vite plugins if type is "module".
   *
   * You can use `id` to give Vite a hint about the file extension.
   */
  content?: string
  /**
   * Path to the script. This value is resolved by Vite so it can be a node module or a file path.
   */
  src?: string
  /**
   * If the script should be loaded asynchronously.
   */
  async?: boolean
  /**
   * Script type.
   * @default 'module'
   */
  type?: string
}

export interface ResolvedBrowserOptions extends BrowserConfigOptions {
  enabled: boolean
  headless: boolean
  isolate: boolean
  api: ApiConfig
}
