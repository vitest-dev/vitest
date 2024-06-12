import type { Awaitable } from '@vitest/utils'
import type { WorkspaceProject } from '../node/workspace'
import type { ApiConfig } from './config'

export interface BrowserProviderInitializationOptions {
  browser: string
  options?: BrowserProviderOptions
}

export interface BrowserProvider {
  name: string
  /**
   * @experimental opt-in into file parallelisation
   */
  supportsParallelism: boolean
  getSupportedBrowsers: () => readonly string[]
  beforeCommand?: (command: string, args: unknown[]) => Awaitable<void>
  afterCommand?: (command: string, args: unknown[]) => Awaitable<void>
  getCommandsContext: (contextId: string) => Record<string, unknown>
  openPage: (contextId: string, url: string) => Promise<void>
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
   * @default 'preview'
   */
  provider?: 'webdriverio' | 'playwright' | 'preview' | (string & {})

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
   * Isolate test environment after each test
   *
   * @default true
   */
  isolate?: boolean

  /**
   * Run test files in parallel if provider supports this option
   * This option only has effect in headless mode (enabled in CI by default)
   *
   * @default // Same as "test.fileParallelism"
   */
  fileParallelism?: boolean

  /**
   * Show Vitest UI
   *
   * @default !process.env.CI
   */
  ui?: boolean

  /**
   * Default viewport size
   */
  viewport?: {
    /**
     * Width of the viewport
     * @default 414
     */
    width: number
    /**
     * Height of the viewport
     * @default 896
     */
    height: number
  }

  /**
   * Directory where screenshots will be saved when page.screenshot() is called
   * If not set, all screenshots are saved to __screenshots__ directory in the same folder as the test file.
   * If this is set, it will be resolved relative to the project root.
   * @default __screenshots__
   */
  screenshotDirectory?: string
  /**
   * Scripts injected into the tester iframe.
   */
  testerScripts?: BrowserScript[]

  /**
   * Scripts injected into the main window.
   */
  orchestratorScripts?: BrowserScript[]

  /**
   * Commands that will be executed on the server
   * via the browser `import("@vitest/browser/context").commands` API.
   * @see {@link https://vitest.dev/guide/browser#commands}
   */
  commands?: Record<string, BrowserCommand<any>>
}

export interface BrowserCommandContext {
  testPath: string | undefined
  provider: BrowserProvider
  project: WorkspaceProject
  contextId: string
}

export interface BrowserCommand<Payload extends unknown[]> {
  (context: BrowserCommandContext, ...payload: Payload): Awaitable<any>
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
  fileParallelism: boolean
  api: ApiConfig
  ui: boolean
  viewport: {
    width: number
    height: number
  }
}
