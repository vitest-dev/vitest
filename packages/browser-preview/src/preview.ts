import type { BrowserProvider, BrowserProviderOption, TestProject } from 'vitest/node'
import { nextTick } from 'node:process'
import { createBrowserServer } from '@vitest/browser'
import { resolve } from 'pathe'
import { distRoot } from './constants'

export function preview(): BrowserProviderOption {
  return {
    name: 'preview',
    options: {},
    providerFactory(project) {
      return new PreviewBrowserProvider(project)
    },
    serverFactory: createBrowserServer,
  }
}

export class PreviewBrowserProvider implements BrowserProvider {
  public name = 'preview' as const
  public supportsParallelism: boolean = false
  private project!: TestProject
  private open = false

  public distRoot: string = distRoot

  public initScripts: string[] = [
    resolve(distRoot, 'locators.js'),
  ]

  constructor(project: TestProject) {
    this.project = project
    this.open = false
    if (project.config.browser.headless) {
      throw new Error(
        'You\'ve enabled headless mode for "preview" provider but it doesn\'t support it. Use "playwright" or "webdriverio" instead: https://vitest.dev/guide/browser/#configuration',
      )
    }
    nextTick(() => {
      project.vitest.logger.printBrowserBanner(project)
    })
  }

  isOpen(): boolean {
    return this.open
  }

  getCommandsContext() {
    return {}
  }

  async openPage(_sessionId: string, url: string): Promise<void> {
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

  async close(): Promise<void> {}
}
