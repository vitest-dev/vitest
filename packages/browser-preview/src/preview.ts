import type { SelectorOptions } from 'vitest/browser'
import type { BrowserProvider, BrowserProviderOption, TestProject } from 'vitest/node'
import { nextTick } from 'node:process'
import { defineBrowserProvider } from '@vitest/browser'
import { resolve } from 'pathe'
import { distRoot } from './constants'

export function preview(): BrowserProviderOption {
  return defineBrowserProvider({
    name: 'preview',
    providerFactory(project) {
      return new PreviewBrowserProvider(project)
    },
  })
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

declare module 'vitest/browser' {
  export interface UserEventClickOptions extends SelectorOptions {}
  export interface UserEventHoverOptions extends SelectorOptions {}
  export interface UserEventFillOptions extends SelectorOptions {}
  export interface UserEventSelectOptions extends SelectorOptions {}
  export interface UserEventClearOptions extends SelectorOptions {}
  export interface UserEventDoubleClickOptions extends SelectorOptions {}
  export interface UserEventTripleClickOptions extends SelectorOptions {}
  export interface UserEventUploadOptions extends SelectorOptions {}
  export interface UserEventWheelBaseOptions extends SelectorOptions {}
  export interface LocatorScreenshotOptions extends SelectorOptions {}
}
