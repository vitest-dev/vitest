import type { BrowserProvider, WorkspaceProject } from 'vitest/node'

export class PreviewBrowserProvider implements BrowserProvider {
  public name = 'preview' as const
  public supportsParallelism: boolean = false
  private ctx!: WorkspaceProject
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

  async initialize(ctx: WorkspaceProject) {
    this.ctx = ctx
    this.open = false
    if (ctx.config.browser.headless) {
      throw new Error(
        'You\'ve enabled headless mode for "preview" provider but it doesn\'t support it. Use "playwright" or "webdriverio" instead: https://vitest.dev/guide/browser#configuration',
      )
    }
  }

  async openPage(_contextId: string, url: string) {
    this.open = true
    if (!this.ctx.browser) {
      throw new Error('Browser is not initialized')
    }
    const options = this.ctx.browser.config.server
    const _open = options.open
    options.open = url
    this.ctx.browser.openBrowser()
    options.open = _open
  }

  async close() {}
}
