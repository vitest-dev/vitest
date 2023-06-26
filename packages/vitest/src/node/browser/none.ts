import type { BrowserProvider, BrowserProviderOptions } from '../../types/browser'
import type { WorkspaceProject } from '../workspace'
import type { Awaitable } from '#types'

export class NoneBrowserProvider implements BrowserProvider {
  public name = 'none'
  private ctx!: WorkspaceProject
  private open = false
  private browser!: string

  requiresBrowser() {
    return false
  }

  getSupportedBrowsers() {
    // `none` supports any browser
    return []
  }

  isOpen() {
    return this.open
  }

  async initialize(ctx: WorkspaceProject, { browser }: BrowserProviderOptions) {
    this.ctx = ctx
    this.open = false
    this.browser = browser
  }

  catchError(_cb: (error: Error) => Awaitable<void>) {
    return () => {}
  }

  async openPage(_url: string) {
    this.open = true
  }

  async close() {
  }
}
