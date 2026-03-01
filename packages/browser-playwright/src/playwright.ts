/* eslint-disable ts/method-signature-style */

import type { CustomComparatorsRegistry } from '@vitest/browser'
import type { MockedModule } from '@vitest/mocker'
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  ConnectOptions,
  Frame,
  FrameLocator,
  LaunchOptions,
  Page,
  CDPSession as PlaywrightCDPSession,
} from 'playwright'
import type { SourceMap } from 'rollup'
import type { ResolvedConfig } from 'vite'
import type {
  Locator,
  ScreenshotComparatorRegistry,
  ScreenshotMatcherOptions,
} from 'vitest/browser'
import type {
  BrowserCommand,
  BrowserModuleMocker,
  BrowserProvider,
  BrowserProviderOption,
  CDPSession,
  TestProject,
} from 'vitest/node'
import { defineBrowserProvider } from '@vitest/browser'
import { createManualModuleSource } from '@vitest/mocker/node'
import { resolve } from 'pathe'
import c from 'tinyrainbow'
import { createDebugger, isCSSRequest } from 'vitest/node'
import commands from './commands'
import { distRoot } from './constants'

const debug = createDebugger('vitest:browser:playwright')

const playwrightBrowsers = ['firefox', 'webkit', 'chromium'] as const
type PlaywrightBrowser = (typeof playwrightBrowsers)[number]

// Enable intercepting of requests made by service workers - experimental API is only available in Chromium based browsers
// Requests from service workers are only available on context.route() https://playwright.dev/docs/service-workers-experimental
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1'

export interface PlaywrightProviderOptions {
  /**
   * The options passed down to [`playwright.connect`](https://playwright.dev/docs/api/class-browsertype#browser-type-launch) method.
   * @see {@link https://playwright.dev/docs/api/class-browsertype#browser-type-launch}
   */
  launchOptions?: Omit<
    LaunchOptions,
    'tracesDir'
  >
  /**
   * The options passed down to [`playwright.connect`](https://playwright.dev/docs/api/class-browsertype#browser-type-connect) method.
   *
   * This is used only if you connect remotely to the playwright instance via a WebSocket connection.
   * @see {@link https://playwright.dev/docs/api/class-browsertype#browser-type-connect}
   */
  connectOptions?: ConnectOptions & {
    wsEndpoint: string
  }
  /**
   * The options passed down to [`browser.newContext`](https://playwright.dev/docs/api/class-browser#browser-new-context) method.
   * @see {@link https://playwright.dev/docs/api/class-browser#browser-new-context}
   */
  contextOptions?: Omit<
    BrowserContextOptions,
    'ignoreHTTPSErrors' | 'serviceWorkers'
  >
  /**
   * The maximum time in milliseconds to wait for `userEvent` action to complete.
   * @default 0 (no timeout)
   */
  actionTimeout?: number

  /**
   * Use a persistent context instead of a regular browser context.
   * This allows browser state (cookies, localStorage, DevTools settings, etc.) to persist between test runs.
   * When set to `true`, the user data is stored in `./node_modules/.cache/vitest-playwright-user-data`.
   * When set to a string, the value is used as the path to the user data directory.
   *
   * Note: This option is ignored when running tests in parallel (e.g. headless with fileParallelism enabled)
   * because persistent context cannot be shared across parallel sessions.
   * @default false
   * @see {@link https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context}
   */
  persistentContext?: boolean | string
}

export function playwright(options: PlaywrightProviderOptions = {}): BrowserProviderOption<PlaywrightProviderOptions> {
  return defineBrowserProvider({
    name: 'playwright',
    supportedBrowser: playwrightBrowsers,
    options,
    providerFactory(project) {
      return new PlaywrightBrowserProvider(project, options)
    },
  })
}

export class PlaywrightBrowserProvider implements BrowserProvider {
  public name = 'playwright' as const
  public supportsParallelism = true

  public browser: Browser | null = null
  public persistentContext: BrowserContext | null = null

  public contexts: Map<string, BrowserContext> = new Map()
  public pages: Map<string, Page> = new Map()
  public mocker: BrowserModuleMocker
  public browserName: PlaywrightBrowser

  private browserPromise: Promise<Browser> | null = null
  private closing = false

  public tracingContexts: Set<string> = new Set()
  public pendingTraces: Map<string, string> = new Map()

  public initScripts: string[] = [
    resolve(distRoot, 'locators.js'),
  ]

  constructor(
    private project: TestProject,
    private options: PlaywrightProviderOptions,
  ) {
    this.browserName = project.config.browser.name as PlaywrightBrowser
    this.mocker = this.createMocker()

    for (const [name, command] of Object.entries(commands)) {
      project.browser!.registerCommand(name as any, command as BrowserCommand)
    }

    // make sure the traces are finished if the test hangs
    process.on('SIGTERM', () => {
      if (!this.browser) {
        return
      }
      const promises = []
      for (const [trace, contextId] of this.pendingTraces.entries()) {
        promises.push((() => {
          const context = this.contexts.get(contextId)
          return context?.tracing.stopChunk({ path: trace })
        })())
      }
      return Promise.allSettled(promises)
    })
  }

  private async openBrowser(openBrowserOptions: { parallel: boolean }) {
    await this._throwIfClosing()

    if (this.browserPromise) {
      debug?.('[%s] the browser is resolving, reusing the promise', this.browserName)
      return this.browserPromise
    }

    if (this.browser) {
      debug?.('[%s] the browser is resolved, reusing it', this.browserName)
      return this.browser
    }

    this.browserPromise = (async () => {
      const options = this.project.config.browser

      const playwright = await import('playwright')

      const launchOptions: LaunchOptions = {
        ...this.options.launchOptions,
        headless: options.headless,
      }

      if (typeof options.trace === 'object' && options.trace.tracesDir) {
        launchOptions.tracesDir = options.trace?.tracesDir
      }

      const inspector = this.project.vitest.config.inspector
      if (inspector.enabled) {
        // NodeJS equivalent defaults: https://nodejs.org/en/learn/getting-started/debugging#enable-inspector
        const port = inspector.port || 9229
        const host = inspector.host || '127.0.0.1'

        launchOptions.args ||= []
        launchOptions.args.push(`--remote-debugging-port=${port}`)

        if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
          this.project.vitest.logger.warn(`Custom inspector host "${host}" will be ignored. Chromium only allows remote debugging on localhost.`)
        }
        this.project.vitest.logger.log(`Debugger listening on ws://127.0.0.1:${port}`)
      }

      // start Vitest UI maximized only on supported browsers
      if (this.project.config.browser.ui && this.browserName === 'chromium') {
        if (!launchOptions.args) {
          launchOptions.args = []
        }
        if (!launchOptions.args.includes('--start-maximized') && !launchOptions.args.includes('--start-fullscreen')) {
          launchOptions.args.push('--start-maximized')
        }
      }

      debug?.('[%s] initializing the browser with launch options: %O', this.browserName, launchOptions)

      if (this.options.connectOptions) {
        let { wsEndpoint, headers = {}, ...connectOptions } = this.options.connectOptions
        if ('x-playwright-launch-options' in headers) {
          this.project.vitest.logger.warn(
            c.yellow(
              'Detected "x-playwright-launch-options" in connectOptions.headers. Provider config launchOptions is ignored.',
            ),
          )
        }
        else {
          headers = { ...headers, 'x-playwright-launch-options': JSON.stringify(launchOptions) }
        }
        this.browser = await playwright[this.browserName].connect(wsEndpoint, {
          ...connectOptions,
          headers,
        })
        this.browserPromise = null
        return this.browser
      }

      let persistentContextOption = this.options.persistentContext
      if (persistentContextOption && openBrowserOptions.parallel) {
        persistentContextOption = false
        this.project.vitest.logger.warn(
          c.yellow(`The persistentContext option is ignored because tests are running in parallel.`),
        )
      }
      if (persistentContextOption) {
        const userDataDir
          = typeof this.options.persistentContext === 'string'
            ? this.options.persistentContext
            : './node_modules/.cache/vitest-playwright-user-data'
        // TODO: how to avoid default "about" page?
        this.persistentContext = await playwright[this.browserName].launchPersistentContext(
          userDataDir,
          {
            ...launchOptions,
            ...this.getContextOptions(),
          },
        )
        this.browser = this.persistentContext.browser()!
      }
      else {
        this.browser = await playwright[this.browserName].launch(launchOptions)
      }
      this.browserPromise = null
      return this.browser
    })()

    return this.browserPromise
  }

  private createMocker(): BrowserModuleMocker {
    const idPreficates = new Map<string, (url: URL) => boolean>()
    const sessionIds = new Map<string, string[]>()

    function createPredicate(sessionId: string, url: string) {
      const moduleUrl = new URL(url, 'http://localhost')
      const predicate = (url: URL) => {
        if (url.searchParams.has('_vitest_original')) {
          return false
        }

        // different modules, ignore request
        if (url.pathname !== moduleUrl.pathname) {
          return false
        }

        url.searchParams.delete('t')
        url.searchParams.delete('v')
        url.searchParams.delete('import')

        // different search params, ignore request
        if (url.searchParams.size !== moduleUrl.searchParams.size) {
          return false
        }

        // check that all search params are the same
        for (const [param, value] of url.searchParams.entries()) {
          if (moduleUrl.searchParams.get(param) !== value) {
            return false
          }
        }

        return true
      }
      const ids = sessionIds.get(sessionId) || []
      ids.push(moduleUrl.href)
      sessionIds.set(sessionId, ids)
      idPreficates.set(predicateKey(sessionId, moduleUrl.href), predicate)
      return predicate
    }

    function predicateKey(sessionId: string, url: string) {
      return `${sessionId}:${url}`
    }

    return {
      register: async (sessionId: string, module: MockedModule): Promise<void> => {
        const page = this.getPage(sessionId)
        await page.context().route(createPredicate(sessionId, module.url), async (route) => {
          if (module.type === 'manual') {
            const exports = Object.keys(await module.resolve())
            const body = createManualModuleSource(module.url, exports)
            return route.fulfill({
              body,
              headers: getHeaders(this.project.browser!.vite.config),
            })
          }

          // webkit doesn't support redirect responses
          // https://github.com/microsoft/playwright/issues/18318
          const isWebkit = this.browserName === 'webkit'
          if (isWebkit) {
            let url: string
            if (module.type === 'redirect') {
              const redirect = new URL(module.redirect)
              url = redirect.href.slice(redirect.origin.length)
            }
            else {
              const request = new URL(route.request().url())
              request.searchParams.set('mock', module.type)
              url = request.href.slice(request.origin.length)
            }

            const result = await this.project.browser!.vite.transformRequest(url).catch(() => null)
            if (!result) {
              return route.continue()
            }
            let content = result.code
            if (result.map && 'version' in result.map && result.map.mappings) {
              const type = isDirectCSSRequest(url) ? 'css' : 'js'
              content = getCodeWithSourcemap(type, content.toString(), result.map)
            }
            return route.fulfill({
              body: content,
              headers: getHeaders(this.project.browser!.vite.config),
            })
          }

          if (module.type === 'redirect') {
            return route.fulfill({
              status: 302,
              headers: {
                Location: module.redirect,
              },
            })
          }
          else if (module.type === 'automock' || module.type === 'autospy') {
            const url = new URL(route.request().url())
            url.searchParams.set('mock', module.type)
            return route.fulfill({
              status: 302,
              headers: {
                Location: url.href,
              },
            })
          }
          else {
            // all types are exhausted
            const _module: never = module
          }
        })
      },
      delete: async (sessionId: string, id: string): Promise<void> => {
        const page = this.getPage(sessionId)
        const key = predicateKey(sessionId, id)
        const predicate = idPreficates.get(key)
        if (predicate) {
          await page.context().unroute(predicate).finally(() => idPreficates.delete(key))
        }
      },
      clear: async (sessionId: string): Promise<void> => {
        const page = this.getPage(sessionId)
        const ids = sessionIds.get(sessionId) || []
        const promises = ids.map((id) => {
          const key = predicateKey(sessionId, id)
          const predicate = idPreficates.get(key)
          if (predicate) {
            return page.context().unroute(predicate).finally(() => idPreficates.delete(key))
          }
          return null
        })
        await Promise.all(promises).finally(() => sessionIds.delete(sessionId))
      },
    }
  }

  private async createContext(sessionId: string, openBrowserOptions: { parallel: boolean }) {
    await this._throwIfClosing()

    if (this.contexts.has(sessionId)) {
      debug?.('[%s][%s] the context already exists, reusing it', sessionId, this.browserName)
      return this.contexts.get(sessionId)!
    }

    const browser = await this.openBrowser(openBrowserOptions)
    await this._throwIfClosing(browser)
    const actionTimeout = this.options.actionTimeout
    const options = this.getContextOptions()
    // TODO: investigate the consequences for Vitest 5
    // else {
    // if UI is disabled, keep the iframe scale to 1
    // options.viewport ??= this.project.config.browser.viewport
    // }
    const context = this.persistentContext ?? await browser.newContext(options)
    await this._throwIfClosing(context)
    if (actionTimeout != null) {
      context.setDefaultTimeout(actionTimeout)
    }
    debug?.('[%s][%s] the context is ready', sessionId, this.browserName)
    this.contexts.set(sessionId, context)
    return context
  }

  private getContextOptions(): BrowserContextOptions {
    const contextOptions = this.options.contextOptions ?? {}
    const options = {
      ...contextOptions,
      ignoreHTTPSErrors: true,
    } satisfies BrowserContextOptions
    if (this.project.config.browser.ui) {
      options.viewport = null
    }
    return options
  }

  public getPage(sessionId: string): Page {
    const page = this.pages.get(sessionId)
    if (!page) {
      throw new Error(`Page "${sessionId}" not found in ${this.browserName} browser.`)
    }
    return page
  }

  public getCommandsContext(sessionId: string): {
    page: Page
    context: BrowserContext
    frame: () => Promise<Frame>
    readonly iframe: FrameLocator
  } {
    const page = this.getPage(sessionId)
    return {
      page,
      context: this.contexts.get(sessionId)!,
      frame(): Promise<Frame> {
        return new Promise<Frame>((resolve, reject) => {
          const frame = page.frame('vitest-iframe')
          if (frame) {
            return resolve(frame)
          }

          const timeout = setTimeout(() => {
            const err = new Error(`Cannot find "vitest-iframe" on the page. This is a bug in Vitest, please report it.`)
            reject(err)
          }, 1000).unref()
          page.on('frameattached', (frame) => {
            clearTimeout(timeout)
            resolve(frame)
          })
        })
      },
      get iframe(): FrameLocator {
        return page.frameLocator('[data-vitest="true"]')!
      },
    }
  }

  private async openBrowserPage(sessionId: string, options: { parallel: boolean }) {
    await this._throwIfClosing()

    if (this.pages.has(sessionId)) {
      debug?.('[%s][%s] the page already exists, closing the old one', sessionId, this.browserName)
      const page = this.pages.get(sessionId)!
      await page.close()
      this.pages.delete(sessionId)
    }

    const context = await this.createContext(sessionId, options)
    const page = await context.newPage()
    debug?.('[%s][%s] the page is ready', sessionId, this.browserName)
    await this._throwIfClosing(page)
    this.pages.set(sessionId, page)

    if (process.env.VITEST_PW_DEBUG) {
      page.on('requestfailed', (request) => {
        console.error(
          '[PW Error]',
          request.resourceType(),
          'request failed for',
          request.url(),
          'url:',
          request.failure()?.errorText,
        )
      })
    }

    return page
  }

  async openPage(sessionId: string, url: string, options: { parallel: boolean }): Promise<void> {
    debug?.('[%s][%s] creating the browser page for %s', sessionId, this.browserName, url)
    const browserPage = await this.openBrowserPage(sessionId, options)
    debug?.('[%s][%s] browser page is created, opening %s', sessionId, this.browserName, url)
    await browserPage.goto(url, { timeout: 0 })
    await this._throwIfClosing(browserPage)
  }

  private async _throwIfClosing(disposable?: { close: () => Promise<void> }) {
    if (this.closing) {
      debug?.('[%s] provider was closed, cannot perform the action on %s', this.browserName, String(disposable))
      await disposable?.close()
      this.pages.clear()
      this.contexts.clear()
      this.browser = null
      this.browserPromise = null
      throw new Error(`[vitest] The provider was closed.`)
    }
  }

  async getCDPSession(sessionid: string): Promise<CDPSession> {
    const page = this.getPage(sessionid)
    const cdp = await page.context().newCDPSession(page)
    return {
      async send(method: string, params: any) {
        const result = await cdp.send(method as 'DOM.querySelector', params)
        return result as unknown
      },
      on(event: string, listener: (...args: any[]) => void) {
        cdp.on(event as 'Accessibility.loadComplete', listener)
      },
      off(event: string, listener: (...args: any[]) => void) {
        cdp.off(event as 'Accessibility.loadComplete', listener)
      },
      once(event: string, listener: (...args: any[]) => void) {
        cdp.once(event as 'Accessibility.loadComplete', listener)
      },
    }
  }

  async close(): Promise<void> {
    debug?.('[%s] closing provider', this.browserName)
    this.closing = true
    if (this.browserPromise) {
      await this.browserPromise
      this.browserPromise = null
    }
    const browser = this.browser
    this.browser = null
    await Promise.all([...this.pages.values()].map(p => p.close()))
    this.pages.clear()
    if (this.persistentContext) {
      await this.persistentContext.close()
    }
    else {
      await Promise.all([...this.contexts.values()].map(c => c.close()))
    }
    this.contexts.clear()
    await browser?.close()
    debug?.('[%s] provider is closed', this.browserName)
  }
}

function getHeaders(config: ResolvedConfig) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/javascript',
  }

  for (const name in config.server.headers) {
    headers[name] = String(config.server.headers[name]!)
  }
  return headers
}

function getCodeWithSourcemap(
  type: 'js' | 'css',
  code: string,
  map: SourceMap,
): string {
  if (type === 'js') {
    code += `\n//# sourceMappingURL=${genSourceMapUrl(map)}`
  }
  else if (type === 'css') {
    code += `\n/*# sourceMappingURL=${genSourceMapUrl(map)} */`
  }

  return code
}

function genSourceMapUrl(map: SourceMap | string): string {
  if (typeof map !== 'string') {
    map = JSON.stringify(map)
  }
  return `data:application/json;base64,${Buffer.from(map).toString('base64')}`
}

const directRequestRE = /[?&]direct\b/

function isDirectCSSRequest(request: string): boolean {
  return isCSSRequest(request) && directRequestRE.test(request)
}

declare module 'vitest/node' {
  export interface BrowserCommandContext {
    page: Page
    frame(): Promise<Frame>
    iframe: FrameLocator
    context: BrowserContext
  }

  export interface _BrowserNames {
    playwright: PlaywrightBrowser
  }

  export interface ToMatchScreenshotOptions
    extends Omit<
      ScreenshotMatcherOptions,
      'comparatorName' | 'comparatorOptions'
    >, CustomComparatorsRegistry {}

  export interface ToMatchScreenshotComparators
    extends ScreenshotComparatorRegistry {}
}

type PWHoverOptions = NonNullable<Parameters<Page['hover']>[1]>
type PWClickOptions = NonNullable<Parameters<Page['click']>[1]>
type PWDoubleClickOptions = NonNullable<Parameters<Page['dblclick']>[1]>
type PWFillOptions = NonNullable<Parameters<Page['fill']>[2]>
type PWScreenshotOptions = NonNullable<Parameters<Page['screenshot']>[0]>
type PWSelectOptions = NonNullable<Parameters<Page['selectOption']>[2]>
type PWDragAndDropOptions = NonNullable<Parameters<Page['dragAndDrop']>[2]>
type PWSetInputFiles = NonNullable<Parameters<Page['setInputFiles']>[2]>
// Must be re-aliased here or rollup-plugin-dts removes the import alias and you end up with a circular reference
type PWCDPSession = PlaywrightCDPSession

declare module 'vitest/browser' {
  export interface UserEventHoverOptions extends PWHoverOptions {}
  export interface UserEventClickOptions extends PWClickOptions {}
  export interface UserEventDoubleClickOptions extends PWDoubleClickOptions {}
  export interface UserEventTripleClickOptions extends PWClickOptions {}
  export interface UserEventFillOptions extends PWFillOptions {}
  export interface UserEventSelectOptions extends PWSelectOptions {}
  export interface UserEventDragAndDropOptions extends PWDragAndDropOptions {}
  export interface UserEventUploadOptions extends PWSetInputFiles {}

  export interface ScreenshotOptions extends Omit<PWScreenshotOptions, 'mask'> {
    mask?: ReadonlyArray<Element | Locator> | undefined
  }

  export interface CDPSession extends PWCDPSession {}
}
