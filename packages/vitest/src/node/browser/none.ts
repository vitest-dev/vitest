import type { BrowserProvider } from '../../types/browser'
import type { WorkspaceProject } from '../workspace'

export class NoneBrowserProvider implements BrowserProvider {
  public name = 'none'
  private ctx!: WorkspaceProject

  getSupportedBrowsers() {
    // `none` supports any browser
    return []
  }

  async initialize(ctx: WorkspaceProject) {
    this.ctx = ctx
  }

  async openBrowser() {
  }

  async openPage(url: string) {
  }

  async close() {
  }
}
