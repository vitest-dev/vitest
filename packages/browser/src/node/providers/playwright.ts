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
} from 'playwright'
import type { SourceMap } from 'rollup'
import type { ResolvedConfig } from 'vite'
import type {
  BrowserModuleMocker,
  BrowserProvider,
  BrowserProviderInitializationOptions,
  CDPSession,
  TestProject,
} from 'vitest/node'
import { createManualModuleSource } from '@vitest/mocker/node'
import c from 'tinyrainbow'
import { createDebugger, isCSSRequest } from 'vitest/node'

const debug = createDebugger('vitest:browser:playwright')

export const playwrightBrowsers = ['firefox', 'webkit', 'chromium'] as const
export type PlaywrightBrowser = (typeof playwrightBrowsers)[number]

export interface PlaywrightProviderOptions
  extends BrowserProviderInitializationOptions {
  browser: PlaywrightBrowser
}

export class PlaywrightBrowserProvider implements BrowserProvider {
  public name = 'playwright' as const
  public supportsParallelism = true

  public browser: Browser | null = null

  private browserName!: PlaywrightBrowser
  private project!: TestProject

  private options?: {
    launch?: LaunchOptions
    connect?: {
      wsEndpoint: string
      options?: ConnectOptions
    }
    context?: BrowserContextOptions & { actionTimeout?: number }
  }

  public contexts: Map<string, BrowserContext> = new Map()
  public pages: Map<string, Page> = new Map()

  private browserPromise: Promise<Browser> | null = null

  public mocker: BrowserModuleMocker | undefined

  private closing = false

  getSupportedBrowsers(): readonly string[] {
    return playwrightBrowsers
  }

  initialize(
    project: TestProject,
    { browser, options }: PlaywrightProviderOptions,
  ): void {
    this.closing = false
    this.project = project
    this.browserName = browser
    this.options = options as any
    this.mocker = this.createMocker()
  }

  private async openBrowser() {
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

      if (this.options?.connect) {
        if (this.options.launch) {
          this.project.vitest.logger.warn(
            c.yellow(`Found both ${c.bold(c.italic(c.yellow('connect')))} and ${c.bold(c.italic(c.yellow('launch')))} options in browser instance configuration.
          Ignoring ${c.bold(c.italic(c.yellow('launch')))} options and using ${c.bold(c.italic(c.yellow('connect')))} mode.
          You probably want to remove one of the two options and keep only the one you want to use.`),
          )
        }
        const browser = await playwright[this.browserName].connect(this.options.connect.wsEndpoint, this.options.connect.options)
        this.browser = browser
        this.browserPromise = null
        return this.browser
      }

      const launchOptions = {
        ...this.options?.launch,
        headless: options.headless,
      } satisfies LaunchOptions

      if (this.project.config.inspector.enabled) {
        // NodeJS equivalent defaults: https://nodejs.org/en/learn/getting-started/debugging#enable-inspector
        const port = this.project.config.inspector.port || 9229
        const host = this.project.config.inspector.host || '127.0.0.1'

        launchOptions.args ||= []
        launchOptions.args.push(`--remote-debugging-port=${port}`)
        launchOptions.args.push(`--remote-debugging-address=${host}`)

        this.project.vitest.logger.log(`Debugger listening on ws://${host}:${port}`)
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
      this.browser = await playwright[this.browserName].launch(launchOptions)
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
        await page.route(createPredicate(sessionId, module.url), async (route) => {
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
          await page.unroute(predicate).finally(() => idPreficates.delete(key))
        }
      },
      clear: async (sessionId: string): Promise<void> => {
        const page = this.getPage(sessionId)
        const ids = sessionIds.get(sessionId) || []
        const promises = ids.map((id) => {
          const key = predicateKey(sessionId, id)
          const predicate = idPreficates.get(key)
          if (predicate) {
            return page.unroute(predicate).finally(() => idPreficates.delete(key))
          }
          return null
        })
        await Promise.all(promises).finally(() => sessionIds.delete(sessionId))
      },
    }
  }

  private async createContext(sessionId: string) {
    await this._throwIfClosing()

    if (this.contexts.has(sessionId)) {
      debug?.('[%s][%s] the context already exists, reusing it', sessionId, this.browserName)
      return this.contexts.get(sessionId)!
    }

    const browser = await this.openBrowser()
    await this._throwIfClosing(browser)
    const { actionTimeout, ...contextOptions } = this.options?.context ?? {}
    const options = {
      ...contextOptions,
      ignoreHTTPSErrors: true,
    } satisfies BrowserContextOptions
    if (this.project.config.browser.ui) {
      options.viewport = null
    }
    const context = await browser.newContext(options)
    await this._throwIfClosing(context)
    if (actionTimeout) {
      context.setDefaultTimeout(actionTimeout)
    }
    debug?.('[%s][%s] the context is ready', sessionId, this.browserName)
    this.contexts.set(sessionId, context)
    return context
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

  private async openBrowserPage(sessionId: string) {
    await this._throwIfClosing()

    if (this.pages.has(sessionId)) {
      debug?.('[%s][%s] the page already exists, closing the old one', sessionId, this.browserName)
      const page = this.pages.get(sessionId)!
      await page.close()
      this.pages.delete(sessionId)
    }

    const context = await this.createContext(sessionId)
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

  async openPage(sessionId: string, url: string, beforeNavigate?: () => Promise<void>): Promise<void> {
    debug?.('[%s][%s] creating the browser page for %s', sessionId, this.browserName, url)
    const browserPage = await this.openBrowserPage(sessionId)
    await beforeNavigate?.()
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
    const browser = this.browser
    this.browser = null
    if (this.browserPromise) {
      await this.browserPromise
      this.browserPromise = null
    }
    await Promise.all([...this.pages.values()].map(p => p.close()))
    this.pages.clear()
    await Promise.all([...this.contexts.values()].map(c => c.close()))
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
