import type { Browser } from 'webdriverio'
import type { Awaitable } from '@vitest/utils'
import { createDefer } from '@vitest/utils'
import { isCI } from '../../utils'
import type { BrowserProvider } from '../../types/browser'
import { ensurePackageInstalled } from '../pkg'
import type { Vitest } from '../core'

export class WebdriverBrowserProvider implements BrowserProvider {
  private cachedBrowser: Browser | null = null
  private testDefers = new Map<string, ReturnType<typeof createDefer>>()
  private stopSafari: () => void = () => {}
  private host = ''
  private ctx!: Vitest

  async initialize(ctx: Vitest) {
    this.ctx = ctx
    this.host = `http://${ctx.config.api?.host || 'localhost'}:${ctx.config.api?.port}`

    const root = this.ctx.config.root
    if (!await ensurePackageInstalled('webdriverio', root))
      throw new Error('Cannot find "webdriverio" package. Please install it manually.')

    if (this.ctx.config.browser === 'safari' && !await ensurePackageInstalled('safaridriver', root))
      throw new Error('Cannot find "safaridriver" package. Please install it manually.')
  }

  async openBrowser() {
    if (this.cachedBrowser)
      return this.cachedBrowser

    const browser = this.ctx.config.browser as string
    const options = this.ctx.config.browserOptions

    if (browser === 'safari') {
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
        'browserName': browser,
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
      const browserInstance = await this.openBrowser()

      const isolate = this.ctx.config.isolate
      if (isolate) {
        for (const file of files) {
          const url = new URL(this.host)
          url.searchParams.append('path', file)
          url.searchParams.set('id', file)
          await browserInstance.url(url.toString())
          await this.waitForTest(file)
        }
      }
      else {
        const url = new URL(this.host)
        url.searchParams.set('id', 'no-isolate')
        files.forEach(file => url.searchParams.append('path', file))
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
          this.cachedBrowser?.deleteSession?.(),
        ])
        // TODO: right now process can only exit with timeout, if we use browser
        // needs investigating
        process.exit()
      },
    }
  }
}
