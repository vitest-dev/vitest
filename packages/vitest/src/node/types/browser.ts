import type { MockedModule } from '@vitest/mocker'
import type { CancelReason } from '@vitest/runner'
import type { Awaitable, ParsedStack, TestError } from '@vitest/utils'
import type { StackTraceParserOptions } from '@vitest/utils/source-map'
import type { ViteDevServer } from 'vite'
import type { BrowserTesterOptions } from '../../types/browser'
import type { TestProject } from '../project'
import type { ApiConfig, ProjectConfig } from './config'

export interface CDPSession {
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>
  on: (event: string, listener: (...args: unknown[]) => void) => void
  once: (event: string, listener: (...args: unknown[]) => void) => void
  off: (event: string, listener: (...args: unknown[]) => void) => void
}

export interface BrowserModuleMocker {
  register: (sessionId: string, module: MockedModule) => Promise<void>
  delete: (sessionId: string, url: string) => Promise<void>
  clear: (sessionId: string) => Promise<void>
}

export interface BrowserProviderOption {
  name: string
  supportedBrowser?: ReadonlyArray<string>
  factory: (project: TestProject) => BrowserProvider
}

export interface BrowserProvider {
  name: string
  mocker?: BrowserModuleMocker
  /**
   * @experimental opt-in into file parallelisation
   */
  supportsParallelism: boolean
  getCommandsContext: (sessionId: string) => Record<string, unknown>
  openPage: (sessionId: string, url: string) => Promise<void>
  getCDPSession?: (sessionId: string) => Promise<CDPSession>
  close: () => Awaitable<void>
}

export type BrowserBuiltinProvider = 'webdriverio' | 'playwright' | 'preview'

type UnsupportedProperties
  = | 'browser'
    | 'typecheck'
    | 'alias'
    | 'sequence'
    | 'root'
    | 'pool'
    | 'poolOptions'
  // browser mode doesn't support a custom runner
    | 'runner'
  // non-browser options
    | 'api'
    | 'deps'
    | 'environment'
    | 'environmentOptions'
    | 'server'
    | 'benchmark'
    | 'name'

export type TraceViewMode = 'on' | 'off' | 'on-first-retry' | 'on-all-retries' | 'retain-on-failure'

export interface BrowserInstanceOption extends
  Omit<ProjectConfig, UnsupportedProperties>,
  Pick<
    BrowserConfigOptions,
    | 'headless'
    | 'locators'
    | 'viewport'
    | 'testerHtmlPath'
    | 'screenshotDirectory'
    | 'screenshotFailures'
    | 'provider'
  > {
  /**
   * Name of the browser
   */
  browser: string

  name?: string
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
   * @deprecated use `instances` instead. if both are defined, this will filter `instances` by name.
   * @internal
   */
  name?: string

  /**
   * Configurations for different browser setups
   */
  instances: BrowserInstanceOption[]

  /**
   * Browser provider
   */
  provider?: BrowserProviderOption

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

  // TODO: hide ui when trace view is enabled
  /**
   * Supported only by **playwright** provider.
   */
  trace?: TraceViewMode | {
    tracesDir?: string
    mode: TraceViewMode
    screenshots?: boolean
    snapshots?: boolean
    sources?: boolean
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

  /**
   * Timeout for connecting to the browser
   * @default 30000
   */
  connectTimeout?: number

  expect?: {
    toMatchScreenshot?: {
      [ComparatorName in keyof ToMatchScreenshotComparators]:
      {
        /**
         * The name of the comparator to use for visual diffing.
         *
         * @defaultValue `'pixelmatch'`
         */
        comparatorName?: ComparatorName
        comparatorOptions?: ToMatchScreenshotComparators[ComparatorName]
      }
    }[keyof ToMatchScreenshotComparators] & ToMatchScreenshotOptions
  }

  /**
   * Enables tracking uncaught errors and exceptions so they can be reported by Vitest.
   *
   * If you need to hide certain errors, it is recommended to use [`onUnhandledError`](https://vitest.dev/config/#onunhandlederror) option instead.
   *
   * Disabling this will completely remove all Vitest error handlers, which can help debugging with the "Pause on exceptions" checkbox turned on.
   * @default true
   */
  trackUnhandledErrors?: boolean
}

export interface BrowserCommandContext {
  testPath: string | undefined
  provider: BrowserProvider
  project: TestProject
  sessionId: string
}

export interface BrowserServerStateSession {
  project: TestProject
  connected: () => void
  fail: (v: Error) => void
}

export interface BrowserOrchestrator {
  cleanupTesters: () => Promise<void>
  createTesters: (options: BrowserTesterOptions) => Promise<void>
  onCancel: (reason: CancelReason) => Promise<void>
  $close: () => void
}

export interface BrowserServerState {
  orchestrators: Map<string, BrowserOrchestrator>
}

export interface ParentProjectBrowser {
  spawn: (project: TestProject) => ProjectBrowser
}

export interface ProjectBrowser {
  vite: ViteDevServer
  state: BrowserServerState
  provider: BrowserProvider
  close: () => Promise<void>
  initBrowserProvider: (project: TestProject) => Promise<void>
  parseStacktrace: (stack: string) => ParsedStack[]
  parseErrorStacktrace: (error: TestError, options?: StackTraceParserOptions) => ParsedStack[]
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
  name: string
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
  trace: {
    tracesDir?: string
    mode: TraceViewMode
    screenshots?: boolean
    snapshots?: boolean
    // TODO: map locations to test ones
    // sources?: boolean
  }
}

type ToMatchScreenshotResolvePath = (data: {
  /**
   * Path **without** extension, sanitized and relative to the test file.
   *
   * This comes from the arguments passed to `toMatchScreenshot`; if called
   * without arguments this will be the auto-generated name.
   *
   * @example
   * test('calls `onClick`', () => {
   *   expect(locator).toMatchScreenshot()
   *   // arg = "calls-onclick-1"
   * })
   *
   * @example
   * expect(locator).toMatchScreenshot('foo/bar/baz.png')
   * // arg = "foo/bar/baz"
   *
   * @example
   * expect(locator).toMatchScreenshot('../foo/bar/baz.png')
   * // arg = "foo/bar/baz"
   */
  arg: string
  /**
   * Screenshot extension, with leading dot.
   *
   * This can be set through the arguments passed to `toMatchScreenshot`, but
   * the value will fall back to `'.png'` if an unsupported extension is used.
   */
  ext: string
  /**
   * The instance's browser name.
   */
  browserName: string
  /**
   * The value of {@linkcode process.platform}.
   */
  platform: NodeJS.Platform
  /**
   * The value provided to
   * {@linkcode https://vitest.dev/guide/browser/config#browser-screenshotdirectory|browser.screenshotDirectory},
   * if none is provided, its default value.
   */
  screenshotDirectory: string
  /**
   * Absolute path to the project's
   * {@linkcode https://vitest.dev/config/#root|root}.
   */
  root: string
  /**
   * Path to the test file, relative to the project's
   * {@linkcode https://vitest.dev/config/#root|root}.
   */
  testFileDirectory: string
  /**
   * The test's filename.
   */
  testFileName: string
  /**
   * The {@linkcode https://vitest.dev/api/#test|test}'s name, including
   * parent {@linkcode https://vitest.dev/api/#describe|describe}, sanitized.
   */
  testName: string
  /**
   * The value provided to
   * {@linkcode https://vitest.dev/config/#attachmentsdir|attachmentsDir},
   * if none is provided, its default value.
   */
  attachmentsDir: string
}) => string

export interface ToMatchScreenshotOptions {
  /**
   * Overrides default reference screenshot path.
   *
   * @default `${root}/${testFileDirectory}/${screenshotDirectory}/${testFileName}/${arg}-${browserName}-${platform}${ext}`
   */
  resolveScreenshotPath?: ToMatchScreenshotResolvePath
  /**
   * Overrides default screenshot path used for diffs.
   *
   * @default `${root}/${attachmentsDir}/${testFileDirectory}/${testFileName}/${arg}-${browserName}-${platform}${ext}`
   */
  resolveDiffPath?: ToMatchScreenshotResolvePath
}

export interface ToMatchScreenshotComparators {}
