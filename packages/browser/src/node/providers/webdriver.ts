import type { Capabilities } from '@wdio/types'
import type {
  BrowserProvider,
  BrowserProviderInitializationOptions,
  TestProject,
} from 'vitest/node'

const webdriverBrowsers = ['firefox', 'chrome', 'edge', 'safari'] as const
type WebdriverBrowser = (typeof webdriverBrowsers)[number]

interface WebdriverProviderOptions
  extends BrowserProviderInitializationOptions {
  browser: WebdriverBrowser
}

export class WebdriverBrowserProvider implements BrowserProvider {
  public name = 'webdriverio' as const
  public supportsParallelism: boolean = false

  public browser: WebdriverIO.Browser | null = null

  private browserName!: WebdriverBrowser
  private project!: TestProject

  private options?: Capabilities.WebdriverIOConfig

  getSupportedBrowsers(): readonly string[] {
    return webdriverBrowsers
  }

  async initialize(
    ctx: TestProject,
    { browser, options }: WebdriverProviderOptions,
  ): Promise<void> {
    this.project = ctx
    this.browserName = browser
    this.options = options as Capabilities.WebdriverIOConfig
  }

  async switchToTestFrame(): Promise<void> {
    const page = this.browser!
    // support wdio@9
    if (page.switchFrame) {
      await page.switchFrame(page.$('iframe[data-vitest]'))
    }
    else {
      const iframe = await page.findElement(
        'css selector',
        'iframe[data-vitest]',
      )
      await page.switchToFrame(iframe)
    }
  }

  async switchToMainFrame(): Promise<void> {
    const page = this.browser!
    if (page.switchFrame) {
      await page.switchFrame(null)
    }
    else {
      await page.switchToParentFrame()
    }
  }

  getCommandsContext(): {
    browser: WebdriverIO.Browser | null
  } {
    return {
      browser: this.browser,
    }
  }

  async openBrowser(): Promise<WebdriverIO.Browser> {
    if (this.browser) {
      return this.browser
    }

    const options = this.project.config.browser

    if (this.browserName === 'safari') {
      if (options.headless) {
        throw new Error(
          'You\'ve enabled headless mode for Safari but it doesn\'t currently support it.',
        )
      }
    }

    const { remote } = await import('webdriverio')

    // TODO: close everything, if browser is closed from the outside
    this.browser = await remote({
      ...this.options,
      logLevel: 'error',
      capabilities: this.buildCapabilities(),
    })

    return this.browser
  }

  private buildCapabilities() {
    const capabilities: Capabilities.WebdriverIOConfig['capabilities'] = {
      ...this.options?.capabilities,
      browserName: this.browserName,
    }

    const headlessMap = {
      chrome: ['goog:chromeOptions', ['headless', 'disable-gpu']],
      firefox: ['moz:firefoxOptions', ['-headless']],
      edge: ['ms:edgeOptions', ['--headless']],
    } as const

    const options = this.project.config.browser
    const browser = this.browserName
    if (browser !== 'safari' && options.headless) {
      const [key, args] = headlessMap[browser]
      const currentValues = (this.options?.capabilities as any)?.[key] || {}
      const newArgs = [...(currentValues.args || []), ...args]
      capabilities[key] = { ...currentValues, args: newArgs as any }
    }

    // start Vitest UI maximized only on supported browsers
    if (options.ui && (browser === 'chrome' || browser === 'edge')) {
      const key = browser === 'chrome'
        ? 'goog:chromeOptions'
        : 'ms:edgeOptions'
      const args = capabilities[key]?.args || []
      if (!args.includes('--start-maximized') && !args.includes('--start-fullscreen')) {
        args.push('--start-maximized')
      }
      capabilities[key] ??= {}
      capabilities[key]!.args = args
    }

    return capabilities
  }

  async openPage(_sessionId: string, url: string): Promise<void> {
    const browserInstance = await this.openBrowser()
    await browserInstance.url(url)
  }

  async close(): Promise<void> {
    await Promise.all([
      this.browser?.sessionId ? this.browser?.deleteSession?.() : null,
    ])
    // TODO: right now process can only exit with timeout, if we use browser
    // needs investigating
    process.exit()
  }
}
