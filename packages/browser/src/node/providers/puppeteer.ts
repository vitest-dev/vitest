import type { Browser, LaunchOptions, Page } from 'puppeteer'
import type { BrowserProvider, BrowserProviderInitializationOptions, WorkspaceProject } from 'vitest/node'

type Awaitable<T> = T | PromiseLike<T>

export const puppeteerBrowsers = ['chrome', 'firefox'] as const
export type PuppeteerBrowser = typeof puppeteerBrowsers[number]

export interface PuppeteerProviderOptions extends BrowserProviderInitializationOptions {
  browser: PuppeteerBrowser
}

export class PuppeteerBrowserProvider implements BrowserProvider {
  public name = 'puppeteer'

  private cachedBrowser: Browser | null = null
  private cachedPage: Page | null = null
  private browser!: PuppeteerBrowser
  private ctx!: WorkspaceProject

  private options?: {
    launch?: LaunchOptions
  }

  getSupportedBrowsers() {
    return puppeteerBrowsers
  }

  async initialize(ctx: WorkspaceProject, { browser, options }: PuppeteerProviderOptions) {
    this.ctx = ctx
    this.browser = browser || 'chrome'
    this.options = options as any
  }

  private async openBrowserPage() {
    if (this.cachedPage)
      return this.cachedPage

    const options = this.ctx.config.browser

    const puppeteer = await import('puppeteer')

    const headless = options.headless == null ? 'new' : (options.headless ? 'new' : false)
    const browser = await puppeteer.launch({
      ...this.options?.launch,
      headless,
      product: this.browser,
    })
    this.cachedBrowser = browser
    this.cachedPage = await browser.newPage()

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
    await this.cachedPage?.close()
    await this.cachedBrowser?.close()
  }
}
