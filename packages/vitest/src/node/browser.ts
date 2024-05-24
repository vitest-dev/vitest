import type { ViteDevServer } from 'vite'
import { getBrowserProvider } from '../integrations/browser'
import type { BrowserProvider } from '../node'
import { createBrowserServer } from '../integrations/browser/server'
import type { WorkspaceProject } from './workspace'

export class BrowserTester {
  public provider!: BrowserProvider
  public server!: ViteDevServer

  public state: {
    files: string[]
    resolve: () => void
    reject: (v: unknown) => void
  } | undefined

  async startServer(project: WorkspaceProject) {
    await this.server?.close()
    this.server = await createBrowserServer(project, project.sharedConfig.configFile)
  }

  async initialize(project: WorkspaceProject) {
    if (this.provider)
      return
    const Provider = await getBrowserProvider(project.config.browser, project)
    this.provider = new Provider()
    const browser = project.config.browser.name
    const supportedBrowsers = this.provider.getSupportedBrowsers()
    const name = project.getName()
    if (!browser)
      throw new Error(`[${name}] Browser name is required. Please, set \`test.browser.name\` option manually.`)
    if (supportedBrowsers.length && !supportedBrowsers.includes(browser))
      throw new Error(`[${name}] Browser "${browser}" is not supported by the browser provider "${this.provider.name}". Supported browsers: ${supportedBrowsers.join(', ')}.`)
    const providerOptions = project.config.browser.providerOptions
    await this.provider.initialize(project, { browser, options: providerOptions })
  }

  public async close() {
    await Promise.all([
      this.provider?.close(),
      this.server?.close(),
    ])
  }
}
