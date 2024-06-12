import type { BrowserProvider, BrowserProviderInitializationOptions, WorkspaceProject } from 'vitest/node'
import type { RemoteOptions } from 'webdriverio'

const webdriverBrowsers = ['firefox', 'chrome', 'edge', 'safari'] as const
type WebdriverBrowser = typeof webdriverBrowsers[number]

interface WebdriverProviderOptions extends BrowserProviderInitializationOptions {
  browser: WebdriverBrowser
}

export class WebdriverIOBrowserProvider implements BrowserProvider {
  public name = 'webdriverio' as const

  private browserName!: WebdriverBrowser
  private ctx!: WorkspaceProject

  private options?: RemoteOptions

  public browsers = new Map<string, WebdriverIO.Browser>()

  get supportsParallelism() {
    return this.browserName !== 'firefox'
  }

  getSupportedBrowsers() {
    return webdriverBrowsers
  }

  async initialize(ctx: WorkspaceProject, { browser, options }: WebdriverProviderOptions) {
    this.ctx = ctx
    this.browserName = browser
    this.options = options as RemoteOptions
  }

  async beforeCommand(contextId: string) {
    const page = this.getBrowser(contextId)
    const iframe = await page.findElement('css selector', 'iframe[data-vitest]')
    await page.switchToFrame(iframe)
  }

  async afterCommand(contextId: string) {
    const browser = this.getBrowser(contextId)
    await browser.switchToParentFrame()
  }

  getCommandsContext(contextId: string) {
    return {
      browser: this.getBrowser(contextId),
    }
  }

  public getBrowser(contextId: string) {
    const page = this.browsers.get(contextId)
    if (!page)
      throw new Error(`Page "${contextId}" not found`)
    return page
  }

  private async openBrowser(contextId: string) {
    if (this.browsers.has(contextId))
      return this.browsers.get(contextId)!

    const options = this.ctx.config.browser

    if (this.browserName === 'safari') {
      if (options.headless)
        throw new Error('You\'ve enabled headless mode for Safari but it doesn\'t currently support it.')
    }

    const { remote } = await import('webdriverio')

    const browser = await remote({
      ...this.options,
      logLevel: 'error',
      capabilities: this.buildCapabilities(),
    })
    this.browsers.set(contextId, browser)

    return browser
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
      const newArgs = [...currentValues.args || [], ...args]
      capabilities[key] = { ...currentValues, args: newArgs as any }
    }

    return capabilities
  }

  async openPage(contextId: string, url: string) {
    const browserInstance = await this.openBrowser(contextId)
    await browserInstance.url(url)
  }

  async close() {
    await Promise.all(
      Array.from(this.browsers.values()).map(browser => browser.deleteSession()),
    )
    this.browsers.clear()
  }
}
