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

  private cachedBrowser: Page | null = null
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
    if (this.cachedBrowser)
      return this.cachedBrowser

    const options = this.ctx.config.browser

    const playwright = await import('playwright')

    const playwrightInstance = await playwright[this.browser].launch({
      ...this.options?.launch,
      headless: options.headless,
    })
    this.cachedBrowser = await playwrightInstance.newPage(this.options?.page)

    this.cachedBrowser.on('close', () => {
      playwrightInstance.close()
    })

    return this.cachedBrowser
  }

  catchError(cb: (error: Error) => Awaitable<void>) {
    this.cachedBrowser?.on('pageerror', cb)
    return () => {
      this.cachedBrowser?.off('pageerror', cb)
    }
  }

  async openPage(url: string) {
    const browserInstance = await this.openBrowser()
    await browserInstance.goto(url)
  }

  async close() {
    await this.cachedBrowser?.close()
    // TODO: right now process can only exit with timeout, if we use browser
    // needs investigating
    process.exit()
  }
}
