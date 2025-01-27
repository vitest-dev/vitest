import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Frame,
  LaunchOptions,
  Page,
} from 'playwright'
import type {
  BrowserProvider,
  BrowserProviderInitializationOptions,
  TestProject,
} from 'vitest/node'

export const playwrightBrowsers = ['firefox', 'webkit', 'chromium'] as const
export type PlaywrightBrowser = (typeof playwrightBrowsers)[number]

export interface PlaywrightProviderOptions
  extends BrowserProviderInitializationOptions {
  browser: PlaywrightBrowser
}

export class PlaywrightBrowserProvider implements BrowserProvider {
  public name = 'playwright' as const
  public supportsParallelism = true

  public browser: Browser | null = null

  private browserName!: PlaywrightBrowser
  private project!: TestProject

  private options?: {
    launch?: LaunchOptions
    context?: BrowserContextOptions & { actionTimeout?: number }
  }

  public contexts = new Map<string, BrowserContext>()
  public pages = new Map<string, Page>()

  private browserPromise: Promise<Browser> | null = null

  getSupportedBrowsers() {
    return playwrightBrowsers
  }

  initialize(
    project: TestProject,
    { browser, options }: PlaywrightProviderOptions,
  ) {
    this.project = project
    this.browserName = browser
    this.options = options as any
  }

  private async openBrowser() {
    if (this.browserPromise) {
      return this.browserPromise
    }

    if (this.browser) {
      return this.browser
    }

    this.browserPromise = (async () => {
      const options = this.project.config.browser

      const playwright = await import('playwright')

      const launchOptions = {
        ...this.options?.launch,
        headless: options.headless,
      } satisfies LaunchOptions

      if (this.project.config.inspector.enabled) {
        // NodeJS equivalent defaults: https://nodejs.org/en/learn/getting-started/debugging#enable-inspector
        const port = this.project.config.inspector.port || 9229
        const host = this.project.config.inspector.host || '127.0.0.1'

        launchOptions.args ||= []
        launchOptions.args.push(`--remote-debugging-port=${port}`)
        launchOptions.args.push(`--remote-debugging-address=${host}`)

        this.project.vitest.logger.log(`Debugger listening on ws://${host}:${port}`)
      }

      // start Vitest UI maximized only on supported browsers
      if (this.project.config.browser.ui && this.browserName === 'chromium') {
        if (!launchOptions.args) {
          launchOptions.args = []
        }
        if (!launchOptions.args.includes('--start-maximized') && !launchOptions.args.includes('--start-fullscreen')) {
          launchOptions.args.push('--start-maximized')
        }
      }

      const browser = await playwright[this.browserName].launch(launchOptions)
      this.browser = browser
      this.browserPromise = null
      return this.browser
    })()

    return this.browserPromise
  }

  private async createContext(sessionId: string) {
    if (this.contexts.has(sessionId)) {
      return this.contexts.get(sessionId)!
    }

    const browser = await this.openBrowser()
    const { actionTimeout, ...contextOptions } = this.options?.context ?? {}
    const options = {
      ...contextOptions,
      ignoreHTTPSErrors: true,
      serviceWorkers: 'allow',
    } satisfies BrowserContextOptions
    if (this.project.config.browser.ui) {
      options.viewport = null
    }
    const context = await browser.newContext(options)
    if (actionTimeout) {
      context.setDefaultTimeout(actionTimeout)
    }
    this.contexts.set(sessionId, context)
    return context
  }

  public getPage(sessionId: string) {
    const page = this.pages.get(sessionId)
    if (!page) {
      throw new Error(`Page "${sessionId}" not found in ${this.browserName} browser.`)
    }
    return page
  }

  public getCommandsContext(sessionId: string) {
    const page = this.getPage(sessionId)
    return {
      page,
      context: this.contexts.get(sessionId)!,
      frame() {
        return new Promise<Frame>((resolve, reject) => {
          const frame = page.frame('vitest-iframe')
          if (frame) {
            return resolve(frame)
          }

          const timeout = setTimeout(() => {
            const err = new Error(`Cannot find "vitest-iframe" on the page. This is a bug in Vitest, please report it.`)
            reject(err)
          }, 1000)
          page.on('frameattached', (frame) => {
            clearTimeout(timeout)
            resolve(frame)
          })
        })
      },
      get iframe() {
        return page.frameLocator('[data-vitest="true"]')!
      },
    }
  }

  private async openBrowserPage(sessionId: string) {
    if (this.pages.has(sessionId)) {
      const page = this.pages.get(sessionId)!
      await page.close()
      this.pages.delete(sessionId)
    }

    const context = await this.createContext(sessionId)
    const page = await context.newPage()
    this.pages.set(sessionId, page)

    if (process.env.VITEST_PW_DEBUG) {
      page.on('requestfailed', (request) => {
        console.error(
          '[PW Error]',
          request.resourceType(),
          'request failed for',
          request.url(),
          'url:',
          request.failure()?.errorText,
        )
      })
    }

    // unhandled page crashes will hang vitest process
    page.on('crash', () => {
      const session = this.project.vitest._browserSessions.getSession(sessionId)
      session?.reject(new Error('Page crashed when executing tests'))
    })

    return page
  }

  async openPage(sessionId: string, url: string, beforeNavigate?: () => Promise<void>) {
    const browserPage = await this.openBrowserPage(sessionId)
    await beforeNavigate?.()
    await browserPage.goto(url, { timeout: 0 })
  }

  async getCDPSession(sessionid: string) {
    const page = this.getPage(sessionid)
    const cdp = await page.context().newCDPSession(page)
    return {
      async send(method: string, params: any) {
        const result = await cdp.send(method as 'DOM.querySelector', params)
        return result as unknown
      },
      on(event: string, listener: (...args: any[]) => void) {
        cdp.on(event as 'Accessibility.loadComplete', listener)
      },
      off(event: string, listener: (...args: any[]) => void) {
        cdp.off(event as 'Accessibility.loadComplete', listener)
      },
      once(event: string, listener: (...args: any[]) => void) {
        cdp.once(event as 'Accessibility.loadComplete', listener)
      },
    }
  }

  async close() {
    const browser = this.browser
    this.browser = null
    await Promise.all([...this.pages.values()].map(p => p.close()))
    this.pages.clear()
    await Promise.all([...this.contexts.values()].map(c => c.close()))
    this.contexts.clear()
    await browser?.close()
  }
}
