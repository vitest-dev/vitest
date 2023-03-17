import type { Browser } from 'webdriverio'
import { isCI } from '../utils'
import type { BrowserProvider } from '../types/browser'
import { BaseBrowserProvider } from '../utils/browser'
import type { CliOptions } from '../node/cli-api'

class WebdriverBrowserProvider extends BaseBrowserProvider implements BrowserProvider {
  browser?: string | boolean
  headless: boolean
  cachedBrowser: Browser | null = null

  constructor(options: CliOptions) {
    super()
    this.browser = options.browser as string
    this.headless = options.headless ?? isCI
  }

  async openBrowser() {
    if (this.cachedBrowser)
      return this.cachedBrowser

    if (this.is('safari')) {
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
        'browserName': this.browser as string,
        'wdio:devtoolsOptions': { headless: this.headless ?? isCI },
      },
    })

    return browserInstance
  }

  async start(url: string) {
    const browserInstance = await this.openBrowser()

    await browserInstance.url(url)
  }
}

let provider: WebdriverBrowserProvider | null = null

export function initializeWebdriver(options: CliOptions) {
  return provider = new WebdriverBrowserProvider(options)
}

export function getWebdriver() {
  if (!provider)
    throw new Error('BrowserProvider has not been initialized yet')

  return provider
}
