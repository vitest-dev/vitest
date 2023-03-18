import { promisify } from 'util'
import type { Browser } from 'webdriverio'
import type { Awaitable } from '@vitest/utils'
// @ts-expect-error doesn't have types
import detectBrowser from 'x-default-browser'
import { createDefer } from '@vitest/utils'
import { relative } from 'pathe'
import { isCI } from '../../utils'
import type { BrowserProvider } from '../../types/browser'
import { ensurePackageInstalled } from '../pkg'
import type { Vitest } from '../core'

export class WebdriverBrowserProvider implements BrowserProvider {
  private cachedBrowser: Browser | null = null
  private testDefers = new Map<string, ReturnType<typeof createDefer>>()
  private stopSafari: () => void = () => {}
  private host = ''
  private browser = 'unknown'
  private ctx!: Vitest

  async initialize(ctx: Vitest) {
    this.ctx = ctx
    this.host = `http://${ctx.config.api?.host || 'localhost'}:${ctx.config.api?.port}`

    const root = this.ctx.config.root
    const browser = await this.getBrowserName()

    this.browser = browser

    if (browser === 'unknown' || !browser)
      throw new Error('Cannot detect browser. Please specify it in the config file.')

    if (!await ensurePackageInstalled('webdriverio', root))
      throw new Error('Cannot find "webdriverio" package. Please install it manually.')

    if (browser === 'safari' && !await ensurePackageInstalled('safaridriver', root))
      throw new Error('Cannot find "safaridriver" package. Please install it manually.')
  }

  async getBrowserName(): Promise<string> {
    if (typeof this.ctx.config.browser === 'string')
      return this.ctx.config.browser
    const browser = await promisify(detectBrowser)()
    return browser.browserName
  }

  async openBrowser() {
    if (this.cachedBrowser)
      return this.cachedBrowser

    const options = this.ctx.config.browserOptions

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
        'wdio:devtoolsOptions': { headless: options?.headless ?? isCI },
      },
    })

    return this.cachedBrowser
  }

  canStart() {
    return typeof this.ctx.config.browser === 'string'
  }

  testFinished(id: string): Awaitable<void> {
    this.testDefers.get(id)?.resolve(true)
  }

  private waitForTest(id: string) {
    const defer = createDefer()
    this.testDefers.set(id, defer)
    return defer
  }

  createPool() {
    const runTests = async (files: string[]) => {
      const paths = files.map(file => relative(this.ctx.config.root, file))
      const browserInstance = await this.openBrowser()

      const isolate = this.ctx.config.isolate
      if (isolate) {
        for (const path of paths) {
          const url = new URL(this.host)
          url.searchParams.append('path', path)
          url.searchParams.set('id', path)
          await browserInstance.url(url.toString())
          await this.waitForTest(path)
        }
      }
      else {
        const url = new URL(this.host)
        url.searchParams.set('id', 'no-isolate')
        paths.forEach(path => url.searchParams.append('path', path))
        await browserInstance.url(url.toString())
        await this.waitForTest('no-isolate')
      }
    }

    return {
      runTests,
      close: async () => {
        this.testDefers.clear()
        await Promise.all([
          this.stopSafari(),
          this.cachedBrowser?.sessionId ? this.cachedBrowser?.deleteSession?.() : null,
        ])
        // TODO: right now process can only exit with timeout, if we use browser
        // needs investigating
        process.exit()
      },
    }
  }
}
