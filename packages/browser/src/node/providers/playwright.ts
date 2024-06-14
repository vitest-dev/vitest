import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
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

      const browser = await playwright[this.browserName].launch({
        ...this.options?.launch,
        headless: options.headless,
      })
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
    const context = await browser.newContext({
      ...this.options?.context,
      ignoreHTTPSErrors: true,
      serviceWorkers: 'allow',
    })
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
    const tester = page.frameLocator('iframe[data-vitest]')
    return {
      page,
      tester,
      get body() {
        return page.frameLocator('iframe[data-vitest]').locator('body')
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

    return page
  }

  async openPage(contextId: string, url: string) {
    const browserPage = await this.openBrowserPage(contextId)
    await browserPage.goto(url)
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
