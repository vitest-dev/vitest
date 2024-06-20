import type {
  BrowserProvider,
  BrowserProviderInitializationOptions,
  WorkspaceProject,
} from 'vitest/node'
import type { RemoteOptions } from 'webdriverio'

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
  private ctx!: WorkspaceProject

  private options?: RemoteOptions

  getSupportedBrowsers() {
    return webdriverBrowsers
  }

  async initialize(
    ctx: WorkspaceProject,
    { browser, options }: WebdriverProviderOptions,
  ) {
    this.ctx = ctx
    this.browserName = browser
    this.options = options as RemoteOptions
  }

  async beforeCommand() {
    const page = this.browser!
    const iframe = await page.findElement(
      'css selector',
      'iframe[data-vitest]',
    )
    await page.switchToFrame(iframe)
  }

  async afterCommand() {
    await this.browser!.switchToParentFrame()
  }

  getCommandsContext() {
    return {
      browser: this.browser,
    }
  }

  async openBrowser() {
    if (this.browser) {
      return this.browser
    }

    const options = this.ctx.config.browser

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
    const capabilities: RemoteOptions['capabilities'] = {
      ...this.options?.capabilities,
      browserName: this.browserName,
    }

    const headlessMap = {
      chrome: ['goog:chromeOptions', ['headless', 'disable-gpu']],
      firefox: ['moz:firefoxOptions', ['-headless']],
      edge: ['ms:edgeOptions', ['--headless']],
    } as const

    const options = this.ctx.config.browser
    const browser = this.browserName
    if (browser !== 'safari' && options.headless) {
      const [key, args] = headlessMap[browser]
      const currentValues = (this.options?.capabilities as any)?.[key] || {}
      const newArgs = [...(currentValues.args || []), ...args]
      capabilities[key] = { ...currentValues, args: newArgs as any }
    }

    return capabilities
  }

  async openPage(_contextId: string, url: string) {
    const browserInstance = await this.openBrowser()
    await browserInstance.url(url)
  }

  async close() {
    await Promise.all([
      this.browser?.sessionId ? this.browser?.deleteSession?.() : null,
    ])
    // TODO: right now process can only exit with timeout, if we use browser
    // needs investigating
    process.exit()
  }
}
