import type { Browser, LaunchOptions, Page } from 'playwright'
import type { BrowserProvider, BrowserProviderInitializationOptions, WorkspaceProject } from 'vitest/node'

type Awaitable<T> = T | PromiseLike<T>

export const playwrightBrowsers = ['firefox', 'webkit', 'chromium'] as const
export type PlaywrightBrowser = typeof playwrightBrowsers[number]

export interface PlaywrightProviderOptions extends BrowserProviderInitializationOptions {
  browser: PlaywrightBrowser
}

export class PlaywrightBrowserProvider implements BrowserProvider {
  public name = 'playwright'

  private cachedBrowser: Browser | null = null
  private cachedPage: Page | null = null
  private browser!: PlaywrightBrowser
  private ctx!: WorkspaceProject

  private options?: {
    launch?: LaunchOptions
    page?: Parameters<Browser['newPage']>[0]
  }

  getSupportedBrowsers() {
    return playwrightBrowsers
  }

  async initialize(ctx: WorkspaceProject, { browser, options }: PlaywrightProviderOptions) {
    this.ctx = ctx
    this.browser = browser
    this.options = options as any
  }

  private async openBrowserPage() {
    if (this.cachedPage)
      return this.cachedPage

    const options = this.ctx.config.browser

    const playwright = await import('playwright')

    const browser = await playwright[this.browser].launch({
      ...this.options?.launch,
      headless: options.headless,
    })
    this.cachedBrowser = browser
    this.cachedPage = await browser.newPage(this.options?.page)

    this.cachedPage.on('close', () => {
      browser.close()
    })

    return this.cachedPage
  }

  catchError(cb: (error: Error) => Awaitable<void>) {
    this.cachedPage?.on('pageerror', cb)
    return () => {
      this.cachedPage?.off('pageerror', cb)
    }
  }

  async openPage(url: string) {
    const browserPage = await this.openBrowserPage()
    await browserPage.goto(url)
  }

  async close() {
    const page = this.cachedPage
    this.cachedPage = null
    const browser = this.cachedBrowser
    this.cachedBrowser = null
    await page?.close()
    await browser?.close()
  }
}
