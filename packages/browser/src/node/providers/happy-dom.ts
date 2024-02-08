import type { Browser, BrowserPage, IOptionalBrowserSettings } from 'happy-dom'
import type { BrowserProvider, BrowserProviderInitializationOptions, WorkspaceProject } from 'vitest/node'

export class HappyDomBrowserProvider implements BrowserProvider {
  public name = 'happy-dom'

  private cachedBrowser: Browser | null = null
  private cachedPage: BrowserPage | null = null
  private ctx!: WorkspaceProject

  private options?: IOptionalBrowserSettings

  getSupportedBrowsers() {
    // happy-dom doesn't support selecting a browser
    return []
  }

  initialize(project: WorkspaceProject, { options }: BrowserProviderInitializationOptions) {
    this.ctx = project
    this.options = options as any
  }

  private async openBrowserPage() {
    if (this.cachedPage)
      return this.cachedPage

    const { Browser, BrowserErrorCaptureEnum } = await import('happy-dom')

    const browser = new Browser({
      settings: {
        errorCapture: BrowserErrorCaptureEnum.processLevel,
        ...this.options,
      },
    })
    this.cachedBrowser = browser
    this.cachedPage = browser.newPage()

    return this.cachedPage
  }

  async openPage(url: string) {
    const browserPage = await this.openBrowserPage()
    await browserPage.goto(url)
    await browserPage.waitUntilComplete()
  }

  async close() {
    const page = this.cachedPage
    this.cachedPage = null
    const browser = this.cachedBrowser
    this.cachedBrowser = null
    await page?.close()
    await browser?.close()
  }
}
