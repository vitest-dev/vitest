import type { Awaitable } from 'vitest'
import type { BrowserProvider, WorkspaceProject } from 'vitest/node'

export class NoneBrowserProvider implements BrowserProvider {
  public name = 'none'
  private ctx!: WorkspaceProject
  private open = false

  getSupportedBrowsers() {
    // `none` is not restricted to certain browsers.
    return []
  }

  isOpen() {
    return this.open
  }

  async initialize(ctx: WorkspaceProject) {
    this.ctx = ctx
    this.open = false
    if (ctx.config.browser.headless)
      throw new Error('You\'ve enabled headless mode for "none" provider but it doesn\'t support it.')
  }

  catchError(_cb: (error: Error) => Awaitable<void>) {
    return () => {}
  }

  async openPage(_url: string) {
    this.open = true
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
