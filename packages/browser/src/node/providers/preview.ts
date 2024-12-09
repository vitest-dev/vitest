import type { BrowserProvider, TestProject } from 'vitest/node'

export class PreviewBrowserProvider implements BrowserProvider {
  public name = 'preview' as const
  public supportsParallelism: boolean = false
  private project!: TestProject
  private open = false

  getSupportedBrowsers() {
    // `none` is not restricted to certain browsers.
    return []
  }

  isOpen() {
    return this.open
  }

  getCommandsContext() {
    return {}
  }

  async initialize(project: TestProject) {
    this.project = project
    this.open = false
    if (project.config.browser.headless) {
      throw new Error(
        'You\'ve enabled headless mode for "preview" provider but it doesn\'t support it. Use "playwright" or "webdriverio" instead: https://vitest.dev/guide/browser/#configuration',
      )
    }
    project.vitest.logger.printBrowserBanner(project)
  }

  async openPage(_sessionId: string, url: string) {
    this.open = true
    if (!this.project.browser) {
      throw new Error('Browser is not initialized')
    }
    const options = this.project.browser.vite.config.server
    const _open = options.open
    options.open = url
    this.project.browser.vite.openBrowser()
    options.open = _open
  }

  async close() {}
}
