import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Frame,
  LaunchOptions,
  Page,
} from 'playwright'
import type {
  BrowserProvider,
  BrowserProviderInitializationOptions,
  WorkspaceProject,
} from 'vitest/node'

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
  private ctx!: WorkspaceProject

  private options?: {
    launch?: LaunchOptions
    context?: BrowserContextOptions
  }

  public contexts = new Map<string, BrowserContext>()
  public pages = new Map<string, Page>()

  private browserPromise: Promise<Browser> | null = null

  getSupportedBrowsers() {
    return playwrightBrowsers
  }

  initialize(
    project: WorkspaceProject,
    { browser, options }: PlaywrightProviderOptions,
  ) {
    this.ctx = project
    this.browserName = browser
    this.options = options as any
  }

  private async openBrowser() {
    if (this.browserPromise) {
      return this.browserPromise
    }

    if (this.browser) {
      return this.browser
    }

    this.browserPromise = (async () => {
      const options = this.ctx.config.browser

      const playwright = await import('playwright')

      const launchOptions = {
        ...this.options?.launch,
        headless: options.headless,
      } satisfies LaunchOptions

      if (this.ctx.config.browser.ui) {
        if (!launchOptions.args) {
          launchOptions.args = []
        }
        if (!launchOptions.args.includes('--start-maximized') && !launchOptions.args.includes('--start-fullscreen')) {
          launchOptions.args.push('--start-maximized')
        }
      }

      const browser = await playwright[this.browserName].launch(launchOptions)
      this.browser = browser
      this.browserPromise = null
      return this.browser
    })()

    return this.browserPromise
  }

  private async createContext(contextId: string) {
    if (this.contexts.has(contextId)) {
      return this.contexts.get(contextId)!
    }

    const browser = await this.openBrowser()
    const options = {
      ...this.options?.context,
      ignoreHTTPSErrors: true,
      serviceWorkers: 'allow',
    } satisfies BrowserContextOptions
    if (this.ctx.config.browser.ui) {
      options.viewport = null
    }
    const context = await browser.newContext(options)
    this.contexts.set(contextId, context)
    return context
  }

  public getPage(contextId: string) {
    const page = this.pages.get(contextId)
    if (!page) {
      throw new Error(`Page "${contextId}" not found`)
    }
    return page
  }

  public getCommandsContext(contextId: string) {
    const page = this.getPage(contextId)
    return {
      page,
      context: this.contexts.get(contextId)!,
      frame() {
        return new Promise<Frame>((resolve, reject) => {
          const frame = page.frame('vitest-iframe')
          if (frame) {
            return resolve(frame)
          }

          const timeout = setTimeout(() => {
            const err = new Error(`Cannot find "vitest-iframe" on the page. This is a bug in Vitest, please report it.`)
            reject(err)
          }, 1000)
          page.on('frameattached', (frame) => {
            clearTimeout(timeout)
            resolve(frame)
          })
        })
      },
      get iframe() {
        return page.frameLocator('[data-vitest="true"]')!
      },
    }
  }

  private async openBrowserPage(contextId: string) {
    if (this.pages.has(contextId)) {
      const page = this.pages.get(contextId)!
      await page.close()
      this.pages.delete(contextId)
    }

    const context = await this.createContext(contextId)
    const page = await context.newPage()
    this.pages.set(contextId, page)

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

  async openPage(contextId: string, url: string) {
    const browserPage = await this.openBrowserPage(contextId)
    await browserPage.goto(url)
  }

  async getCDPSession(contextId: string) {
    const page = this.getPage(contextId)
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

  async close() {
    const browser = this.browser
    this.browser = null
    await Promise.all([...this.pages.values()].map(p => p.close()))
    this.pages.clear()
    await Promise.all([...this.contexts.values()].map(c => c.close()))
    this.contexts.clear()
    await browser?.close()
  }
}
