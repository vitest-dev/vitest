import type { Page } from 'playwright'
import type { Awaitable } from '@vitest/utils'
import { createDefer } from '@vitest/utils'
import { relative } from 'pathe'
import type { BrowserProvider } from '../../types/browser'
import { ensurePackageInstalled } from '../pkg'
import type { Vitest } from '../core'

export class PlaywrightBrowserProvider implements BrowserProvider {
  private supportedBrowsers = ['firefox', 'webkit', 'chromium'] as const
  private cachedBrowser: Page | null = null
  private testDefers = new Map<string, ReturnType<typeof createDefer>>()
  private host = ''
  private browser!: typeof this.supportedBrowsers[number]
  private ctx!: Vitest

  async initialize(ctx: Vitest) {
    this.ctx = ctx
    this.host = `http://${ctx.config.browser.api?.host || 'localhost'}:${ctx.browser.config.server.port}`

    const root = this.ctx.config.root
    const browser = this.getBrowserName()

    this.browser = browser as any

    if (!browser)
      throw new Error('Cannot detect browser. Please specify browser.name in the config file.')

    if (!this.supportedBrowsers.includes(this.browser))
      throw new Error(`Playwright provider does not support this browser, and only supports these browsers: ${this.supportedBrowsers.join(', ')}`)

    if (!await ensurePackageInstalled('playwright', root))
      throw new Error('Cannot find "webdriverio" package. Please install it manually.')
  }

  getBrowserName(): string {
    return this.ctx.config.browser.name
  }

  async openBrowser() {
    if (this.cachedBrowser)
      return this.cachedBrowser

    const options = this.ctx.config.browser

    const playwright = await import('playwright')

    const playwrightInstance = await playwright[this.browser].launch({ headless: options.headless })
    this.cachedBrowser = await playwrightInstance.newPage()

    this.cachedBrowser.on('close', () => {
      playwrightInstance.close()
    })

    return this.cachedBrowser
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
    const close = async () => {
      this.testDefers.clear()
      await Promise.all([
        this.cachedBrowser?.close(),
      ])
      // TODO: right now process can only exit with timeout, if we use browser
      // needs investigating
      process.exit()
    }

    const runTests = async (files: string[]) => {
      const paths = files.map(file => relative(this.ctx.config.root, file))
      const browserInstance = await this.openBrowser()

      const isolate = this.ctx.config.isolate
      if (isolate) {
        for (const path of paths) {
          const url = new URL(this.host)
          url.searchParams.append('path', path)
          url.searchParams.set('id', path)
          await browserInstance.goto(url.toString())
          await this.waitForTest(path)
        }
      }
      else {
        const url = new URL(this.host)
        url.searchParams.set('id', 'no-isolate')
        paths.forEach(path => url.searchParams.append('path', path))
        await browserInstance.goto(url.toString())
        await this.waitForTest('no-isolate')
      }
      browserInstance.on('close', () => {
        // if the user closes the browser, then close vitest too
        close()
      })
    }

    return {
      runTests,
      close,
    }
  }
}
