import type { BrowserProvider, BrowserProviderInitializationOptions, WorkspaceProject } from 'vitest/node'
import type { RemoteOptions } from 'webdriverio'

type Awaitable<T> = T | PromiseLike<T>

const webdriverBrowsers = ['firefox', 'chrome', 'edge', 'safari'] as const
type WebdriverBrowser = typeof webdriverBrowsers[number]

interface WebdriverProviderOptions extends BrowserProviderInitializationOptions {
  browser: WebdriverBrowser
}

export class WebdriverBrowserProvider implements BrowserProvider {
  public name = 'webdriverio'

  private cachedBrowser: WebdriverIO.Browser | null = null
  private browser!: WebdriverBrowser
  private ctx!: WorkspaceProject

  private options?: RemoteOptions

  getSupportedBrowsers() {
    return webdriverBrowsers
  }

  async initialize(ctx: WorkspaceProject, { browser, options }: WebdriverProviderOptions) {
    this.ctx = ctx
    this.browser = browser
    this.options = options as RemoteOptions
  }

  async openBrowser() {
    if (this.cachedBrowser)
      return this.cachedBrowser

    const options = this.ctx.config.browser

    if (this.browser === 'safari') {
      if (options.headless)
        throw new Error('You\'ve enabled headless mode for Safari but it doesn\'t currently support it.')
    }

    const { remote } = await import('webdriverio')

    // TODO: close everything, if browser is closed from the outside
    this.cachedBrowser = await remote({
      ...this.options,
      logLevel: 'error',
      capabilities: this.buildCapabilities(),
    })

    return this.cachedBrowser
  }

  private buildCapabilities() {
    const capabilities: RemoteOptions['capabilities'] = {
      ...this.options?.capabilities,
      browserName: this.browser,
    }

    const headlessMap = {
      chrome: ['goog:chromeOptions', ['headless', 'disable-gpu']],
      firefox: ['moz:firefoxOptions', ['-headless']],
      edge: ['ms:edgeOptions', ['--headless']],
    } as const

    const options = this.ctx.config.browser
    const browser = this.browser
    if (browser !== 'safari' && options.headless) {
      const [key, args] = headlessMap[browser]
      const currentValues = (this.options?.capabilities as any)?.[key] || {}
      const newArgs = [...currentValues.args || [], ...args]
      capabilities[key] = { ...currentValues, args: newArgs as any }
    }

    return capabilities
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
      this.cachedBrowser?.sessionId ? this.cachedBrowser?.deleteSession?.() : null,
    ])
    // TODO: right now process can only exit with timeout, if we use browser
    // needs investigating
    process.exit()
  }
}
