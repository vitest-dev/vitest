import type { BrowserProvider, WorkspaceProject } from 'vitest/node'

export class NoneBrowserProvider implements BrowserProvider {
  public name = 'none'
  private ctx!: WorkspaceProject

  getSupportedBrowsers() {
    // `none` is not restricted to certain browsers.
    return []
  }

  async initialize(ctx: WorkspaceProject) {
    this.ctx = ctx
    if (ctx.config.browser.headless)
      throw new Error('You\'ve enabled headless mode for "none" provider but it doesn\'t support it.')
  }

  async openPage(_url: string) {
    if (!this.ctx.browser)
      throw new Error('Browser is not initialized')
    const options = this.ctx.browser.config.server
    const _open = options.open
    options.open = _url
    this.ctx.browser.openBrowser()
    options.open = _open
  }

  async close() {
  }
}
