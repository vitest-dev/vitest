import type { Awaitable, ErrorWithDiff, ParsedStack } from '@vitest/utils'
import type { ViteDevServer } from 'vite'
import type { CancelReason } from '@vitest/runner'
import type { StackTraceParserOptions } from '@vitest/utils/source-map'
import type { WorkspaceProject } from '../workspace'
import type { ApiConfig } from './config'

export interface BrowserProviderInitializationOptions {
  browser: string
  options?: BrowserProviderOptions
}

export interface CDPSession {
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>
  on: (event: string, listener: (...args: unknown[]) => void) => void
  once: (event: string, listener: (...args: unknown[]) => void) => void
  off: (event: string, listener: (...args: unknown[]) => void) => void
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
  openPage: (contextId: string, url: string, beforeNavigate?: () => Promise<void>) => Promise<void>
  getCDPSession?: (contextId: string) => Promise<CDPSession>
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

export type BrowserBuiltinProvider = 'webdriverio' | 'playwright' | 'preview'

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
  provider?: BrowserBuiltinProvider | (string & {})

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
   * Locator options
   */
  locators?: {
    /**
     * Attribute used to locate elements by test id
     * @default 'data-testid'
     */
    testIdAttribute?: string
  }

  /**
   * Directory where screenshots will be saved when page.screenshot() is called
   * If not set, all screenshots are saved to __screenshots__ directory in the same folder as the test file.
   * If this is set, it will be resolved relative to the project root.
   * @default __screenshots__
   */
  screenshotDirectory?: string

  /**
   * Should Vitest take screenshots if the test fails
   * @default !browser.ui
   */
  screenshotFailures?: boolean

  /**
   * Scripts injected into the tester iframe.
   * @deprecated Will be removed in the future, use `testerHtmlPath` instead.
   */
  testerScripts?: BrowserScript[]
  /**
   * Path to the index.html file that will be used to run tests.
   */
  testerHtmlPath?: string

  /**
   * Scripts injected into the main window.
   */
  orchestratorScripts?: BrowserScript[]

  /**
   * Commands that will be executed on the server
   * via the browser `import("@vitest/browser/context").commands` API.
   * @see {@link https://vitest.dev/guide/browser/commands}
   */
  commands?: Record<string, BrowserCommand<any>>
}

export interface BrowserCommandContext {
  testPath: string | undefined
  provider: BrowserProvider
  project: WorkspaceProject
  contextId: string
}

export interface BrowserServerStateContext {
  files: string[]
  method: 'run' | 'collect'
  resolve: () => void
  reject: (v: unknown) => void
}

export interface BrowserOrchestrator {
  createTesters: (files: string[]) => Promise<void>
  onCancel: (reason: CancelReason) => Promise<void>
}

export interface BrowserServerState {
  orchestrators: Map<string, BrowserOrchestrator>
  getContext: (contextId: string) => BrowserServerStateContext | undefined
  createAsyncContext: (method: 'collect' | 'run', contextId: string, files: string[]) => Promise<void>
}

export interface BrowserServer {
  vite: ViteDevServer
  state: BrowserServerState
  provider: BrowserProvider
  close: () => Promise<void>
  initBrowserProvider: () => Promise<void>
  parseStacktrace: (stack: string) => ParsedStack[]
  parseErrorStacktrace: (error: ErrorWithDiff, options?: StackTraceParserOptions) => ParsedStack[]
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
  screenshotFailures: boolean
  locators: {
    testIdAttribute: string
  }
}
