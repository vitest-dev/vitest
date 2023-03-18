import type { Browser } from 'webdriverio'
import type { Vitest } from 'vitest/node'
import { isCI } from '../../utils'
import type { BrowserProvider } from '../../types/browser'
import { ensurePackageInstalled } from '../pkg'

export class WebdriverBrowserProvider implements BrowserProvider {
  private _cachedBrowser: Browser | null = null
  private ctx!: Vitest

  async initialize(ctx: Vitest) {
    this.ctx = ctx

    const root = this.ctx.config.root
    if (!await ensurePackageInstalled('webdriverio', root))
      throw new Error('Cannot find "webdriverio" package. Please install it manually.')

    if (this.ctx.config.browser === 'safari' && !await ensurePackageInstalled('safaridriver', root))
      throw new Error('Cannot find "safaridriver" package. Please install it manually.')
  }

  async openBrowser() {
    if (this._cachedBrowser)
      return this._cachedBrowser

    const browser = this.ctx.config.browser as string
    const options = this.ctx.config.browserOptions

    if (browser === 'safari') {
      const safaridriver = await import('safaridriver')
      safaridriver.start({ diagnose: true })

      process.on('beforeExit', () => {
        safaridriver.stop()
      })
    }

    const { remote } = await import('webdriverio')

    const browserInstance = await remote({
      logLevel: 'error',
      capabilities: {
        'browserName': browser,
        'wdio:devtoolsOptions': { headless: options?.headless ?? isCI },
      },
    })

    this._cachedBrowser = browserInstance

    return browserInstance
  }

  canStart() {
    return typeof this.ctx.config.browser === 'string'
  }

  async start(url: string) {
    const browserInstance = await this.openBrowser()

    await browserInstance.url(url)
  }
}
