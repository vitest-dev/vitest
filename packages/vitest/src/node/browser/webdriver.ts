import type { Awaitable } from '@vitest/utils'
import type { BrowserProvider, BrowserProviderOptions } from '../../types/browser'
import { ensurePackageInstalled } from '../pkg'
import type { WorkspaceProject } from '../workspace'

export const webdriverBrowsers = ['firefox', 'chrome', 'edge', 'safari'] as const
export type WebdriverBrowser = typeof webdriverBrowsers[number]

export interface WebdriverProviderOptions extends BrowserProviderOptions {
  browser: WebdriverBrowser
}

export class WebdriverBrowserProvider implements BrowserProvider {
  public name = 'webdriverio'

  private cachedBrowser: WebdriverIO.Browser | null = null
  private stopSafari: () => void = () => {}
  private browser!: WebdriverBrowser
  private ctx!: WorkspaceProject

  getSupportedBrowsers() {
    return webdriverBrowsers
  }

  async initialize(ctx: WorkspaceProject, { browser }: WebdriverProviderOptions) {
    this.ctx = ctx
    this.browser = browser

    const root = this.ctx.config.root

    if (!await ensurePackageInstalled('webdriverio', root))
      throw new Error('Cannot find "webdriverio" package. Please install it manually.')

    if (browser === 'safari' && !await ensurePackageInstalled('safaridriver', root))
      throw new Error('Cannot find "safaridriver" package. Please install it manually.')
  }

  async openBrowser() {
    if (this.cachedBrowser)
      return this.cachedBrowser

    const options = this.ctx.config.browser

    if (this.browser === 'safari') {
      const safaridriver = await import('safaridriver')
      safaridriver.start({ diagnose: true })
      this.stopSafari = () => safaridriver.stop()

      process.on('beforeExit', () => {
        safaridriver.stop()
      })
    }

    const { remote } = await import('webdriverio')

    // TODO: close everything, if browser is closed from the outside
    this.cachedBrowser = await remote({
      logLevel: 'error',
      capabilities: {
        'browserName': this.browser,
        'wdio:devtoolsOptions': { headless: options.headless },
      },
    })

    return this.cachedBrowser
  }

  async openPage(url: string) {
    const browserInstance = await this.openBrowser()
    await browserInstance.url(url)
  }

  // TODO
  catchError(_cb: (error: Error) => Awaitable<void>) {
    return () => {}
  }

  async close() {
    await Promise.all([
      this.stopSafari(),
      this.cachedBrowser?.sessionId ? this.cachedBrowser?.deleteSession?.() : null,
    ])
    // TODO: right now process can only exit with timeout, if we use browser
    // needs investigating
    process.exit()
  }
}
