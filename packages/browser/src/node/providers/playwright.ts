import type { Page } from 'playwright'
import type { BrowserProvider, BrowserProviderInitializationOptions, BrowserProviderOptions, WorkspaceProject } from 'vitest/node'
import { ensurePackageInstalled } from 'vitest/node'

type Awaitable<T> = T | PromiseLike<T>

export const playwrightBrowsers = ['firefox', 'webkit', 'chromium'] as const
export type PlaywrightBrowser = typeof playwrightBrowsers[number]

export interface PlaywrightProviderOptions extends BrowserProviderInitializationOptions {
  browser: PlaywrightBrowser
}

export class PlaywrightBrowserProvider implements BrowserProvider {
  public name = 'playwright'

  private cachedPage: Page | null = null
  private browser!: PlaywrightBrowser
  private ctx!: WorkspaceProject

  private options?: BrowserProviderOptions['playwright']

  getSupportedBrowsers() {
    return playwrightBrowsers
  }

  async initialize(ctx: WorkspaceProject, { browser, options }: PlaywrightProviderOptions) {
    this.ctx = ctx
    this.browser = browser
    this.options = options as any

    const root = this.ctx.config.root

    if (!await ensurePackageInstalled('playwright', root))
      throw new Error('Cannot find "playwright" package. Please install it manually.')
  }

  async openBrowser() {
    if (this.cachedPage)
      return this.cachedPage

    const options = this.ctx.config.browser

    const playwright = await import('playwright')

    const browser = await playwright[this.browser].launch({
      ...this.options?.launch,
      headless: options.headless,
    })
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
    const browserInstance = await this.openBrowser()
    await browserInstance.goto(url)
  }

  async close() {
    await this.cachedPage?.close()
    // TODO: right now process can only exit with timeout, if we use browser
    // needs investigating
    process.exit()
  }
}
