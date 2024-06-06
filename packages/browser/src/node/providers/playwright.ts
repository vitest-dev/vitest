import type { Browser, BrowserContext, BrowserContextOptions, LaunchOptions, Page } from 'playwright'
import type { BrowserProvider, BrowserProviderInitializationOptions, WorkspaceProject } from 'vitest/node'

export const playwrightBrowsers = ['firefox', 'webkit', 'chromium'] as const
export type PlaywrightBrowser = typeof playwrightBrowsers[number]

export interface PlaywrightProviderOptions extends BrowserProviderInitializationOptions {
  browser: PlaywrightBrowser
}

export class PlaywrightBrowserProvider implements BrowserProvider {
  public name = 'playwright'

  public browser: Browser | null = null
  public page: Page | null = null
  public context: BrowserContext | null = null

  private browserName!: PlaywrightBrowser
  private ctx!: WorkspaceProject

  private options?: {
    launch?: LaunchOptions
    context?: BrowserContextOptions
  }

  getSupportedBrowsers() {
    return playwrightBrowsers
  }

  initialize(project: WorkspaceProject, { browser, options }: PlaywrightProviderOptions) {
    this.ctx = project
    this.browserName = browser
    this.options = options as any
  }

  private async createContext() {
    if (this.context)
      return this.context

    const options = this.ctx.config.browser

    const playwright = await import('playwright')

    const browser = await playwright[this.browserName].launch({
      ...this.options?.launch,
      headless: options.headless,
    })
    this.browser = browser
    this.context = await browser.newContext(this.options?.context)
    return this.context
  }

  private async openBrowserPage() {
    this.context = await this.createContext()
    this.page = await this.context.newPage()

    return this.page
  }

  async openPage(url: string) {
    const browserPage = await this.openBrowserPage()
    await browserPage.goto(url)
  }

  async close() {
    const page = this.page
    this.page = null
    const browser = this.browser
    this.browser = null
    await page?.close()
    await browser?.close()
  }
}
