import type { Page } from 'playwright'
import type { BrowserProvider, BrowserProviderOptions } from '../../types/browser'
import { ensurePackageInstalled } from '../pkg'
import type { WorkspaceProject } from '../workspace'

export const playwrightBrowsers = ['firefox', 'webkit', 'chromium'] as const
export type PlaywrightBrowser = typeof playwrightBrowsers[number]

export interface PlaywrightProviderOptions extends BrowserProviderOptions {
  browser: PlaywrightBrowser
}

export class PlaywrightBrowserProvider implements BrowserProvider {
  public name = 'playwright'

  private cachedBrowser: Page | null = null
  private browser!: PlaywrightBrowser
  private ctx!: WorkspaceProject

  getSupportedBrowsers() {
    return playwrightBrowsers
  }

  async initialize(ctx: WorkspaceProject, { browser }: PlaywrightProviderOptions) {
    this.ctx = ctx
    this.browser = browser

    const root = this.ctx.config.root

    if (!await ensurePackageInstalled('playwright', root))
      throw new Error('Cannot find "playwright" package. Please install it manually.')
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

  async openPage(url: string) {
    const browserInstance = await this.openBrowser()
    await browserInstance.goto(url)
  }

  async close() {
    await this.cachedBrowser?.close()
    // TODO: right now process can only exit with timeout, if we use browser
    // needs investigating
    process.exit()
  }
}
