import type { CustomComparatorsRegistry } from '@vitest/browser'
import type { Capabilities } from '@wdio/types'
import type {
  ScreenshotComparatorRegistry,
  ScreenshotMatcherOptions,
  SelectorOptions,
} from 'vitest/browser'
import type {
  BrowserCommand,
  BrowserProvider,
  BrowserProviderOption,
  CDPSession,
  TestProject,
} from 'vitest/node'
import type { ClickOptions, DragAndDropOptions, MoveToOptions, remote } from 'webdriverio'
import { defineBrowserProvider } from '@vitest/browser'

import { resolve } from 'pathe'
import { createDebugger } from 'vitest/node'
import commands from './commands'
import { distRoot } from './constants'

const debug = createDebugger('vitest:browser:wdio')

const webdriverBrowsers = ['firefox', 'chrome', 'edge', 'safari'] as const
type WebdriverBrowser = (typeof webdriverBrowsers)[number]

export interface WebdriverProviderOptions extends Partial<
  Parameters<typeof remote>[0]
> {}

export function webdriverio(options: WebdriverProviderOptions = {}): BrowserProviderOption<WebdriverProviderOptions> {
  return defineBrowserProvider({
    name: 'webdriverio',
    supportedBrowser: webdriverBrowsers,
    options,
    providerFactory(project) {
      return new WebdriverBrowserProvider(project, options)
    },
  })
}

export class WebdriverBrowserProvider implements BrowserProvider {
  public name = 'webdriverio' as const
  public supportsParallelism: boolean = false

  public browser: WebdriverIO.Browser | null = null

  private browserName!: WebdriverBrowser
  private project!: TestProject

  private options?: WebdriverProviderOptions

  private closing = false
  private iframeSwitched = false
  private topLevelContext: string | undefined

  public initScripts: string[] = [
    resolve(distRoot, 'locators.js'),
  ]

  getSupportedBrowsers(): readonly string[] {
    return webdriverBrowsers
  }

  constructor(
    project: TestProject,
    options: WebdriverProviderOptions,
  ) {
    // increase shutdown timeout because WDIO takes some extra time to kill the driver
    if (!project.vitest.state._data.timeoutIncreased) {
      project.vitest.state._data.timeoutIncreased = true
      project.vitest.config.teardownTimeout += 10_000
    }

    this.closing = false
    this.project = project
    this.browserName = project.config.browser.name as WebdriverBrowser
    this.options = options

    for (const [name, command] of Object.entries(commands)) {
      project.browser!.registerCommand(name as any, command as BrowserCommand)
    }
  }

  isIframeSwitched(): boolean {
    return this.iframeSwitched
  }

  async switchToTestFrame(): Promise<void> {
    const browser = this.browser!
    // support wdio@9
    if (browser.switchFrame) {
      await browser.switchFrame(browser.$('iframe[data-vitest]'))
    }
    else {
      const iframe = await browser.findElement(
        'css selector',
        'iframe[data-vitest]',
      )
      await browser.switchToFrame(iframe)
    }
    this.iframeSwitched = true
  }

  async switchToMainFrame(): Promise<void> {
    const page = this.browser!
    if (page.switchFrame) {
      await page.switchFrame(null)
    }
    else {
      await page.switchToParentFrame()
    }
    this.iframeSwitched = false
  }

  async setViewport(options: { width: number; height: number }): Promise<void> {
    if (this.topLevelContext == null || !this.browser) {
      throw new Error(`The browser has no open pages.`)
    }
    if (this.browser.isBidi) {
      await this.browser.send({
        method: 'browsingContext.setViewport',
        params: {
          context: this.topLevelContext,
          devicePixelRatio: 1,
          viewport: options,
        },
      })
    }
    else {
      await this.browser.setWindowSize(options.width, options.height)
    }
  }

  getCommandsContext(): {
    browser: WebdriverIO.Browser | null
  } {
    return {
      browser: this.browser,
    }
  }

  async openBrowser(): Promise<WebdriverIO.Browser> {
    await this._throwIfClosing('opening the browser')

    if (this.browser) {
      debug?.('[%s] the browser is already opened, reusing it', this.browserName)
      return this.browser
    }

    const options = this.project.config.browser

    if (this.browserName === 'safari') {
      if (options.headless) {
        throw new Error(
          'You\'ve enabled headless mode for Safari but it doesn\'t currently support it.',
        )
      }
    }

    const { remote } = await import('webdriverio')

    const remoteOptions: Capabilities.WebdriverIOConfig = {
      logLevel: 'silent',
      ...this.options,
      capabilities: this.buildCapabilities(),
    }

    debug?.('[%s] opening the browser with options: %O', this.browserName, remoteOptions)
    // TODO: close everything, if browser is closed from the outside
    this.browser = await remote(remoteOptions)
    await this._throwIfClosing()

    return this.browser
  }

  private buildCapabilities() {
    const capabilities: Capabilities.WebdriverIOConfig['capabilities'] = {
      ...this.options?.capabilities,
      browserName: this.browserName,
    }

    const headlessMap = {
      chrome: ['goog:chromeOptions', ['headless', 'disable-gpu']],
      firefox: ['moz:firefoxOptions', ['-headless']],
      edge: ['ms:edgeOptions', ['--headless']],
    } as const

    const options = this.project.config.browser
    const browser = this.browserName
    if (browser !== 'safari' && options.headless) {
      const [key, args] = headlessMap[browser]
      const currentValues = (this.options?.capabilities as any)?.[key] || {}
      const newArgs = [...(currentValues.args || []), ...args]
      capabilities[key] = { ...currentValues, args: newArgs as any }
    }

    // start Vitest UI maximized only on supported browsers
    if (options.ui && (browser === 'chrome' || browser === 'edge')) {
      const key = browser === 'chrome'
        ? 'goog:chromeOptions'
        : 'ms:edgeOptions'
      const args = capabilities[key]?.args || []
      if (!args.includes('--start-maximized') && !args.includes('--start-fullscreen')) {
        args.push('--start-maximized')
      }
      capabilities[key] ??= {}
      capabilities[key]!.args = args
    }

    const inspector = this.project.vitest.config.inspector
    if (inspector.enabled && (browser === 'chrome' || browser === 'edge')) {
      const key = browser === 'chrome'
        ? 'goog:chromeOptions'
        : 'ms:edgeOptions'
      const args = capabilities[key]?.args || []

      // NodeJS equivalent defaults: https://nodejs.org/en/learn/getting-started/debugging#enable-inspector
      const port = inspector.port || 9229
      const host = inspector.host || '127.0.0.1'

      args.push(`--remote-debugging-port=${port}`)

      if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
        this.project.vitest.logger.warn(`Custom inspector host "${host}" will be ignored. Chrome only allows remote debugging on localhost.`)
      }
      this.project.vitest.logger.log(`Debugger listening on ws://127.0.0.1:${port}`)

      capabilities[key] ??= {}
      capabilities[key]!.args = args
    }

    return capabilities
  }

  async openPage(sessionId: string, url: string): Promise<void> {
    await this._throwIfClosing('creating the browser')
    debug?.('[%s][%s] creating the browser page for %s', sessionId, this.browserName, url)
    const browserInstance = await this.openBrowser()
    debug?.('[%s][%s] browser page is created, opening %s', sessionId, this.browserName, url)
    await browserInstance.url(url)
    this.topLevelContext = await browserInstance.getWindowHandle()
    await this._throwIfClosing('opening the url')
  }

  private async _throwIfClosing(action?: string) {
    if (this.closing) {
      debug?.(`[%s] provider was closed, cannot perform the action${action ? ` ${action}` : ''}`, this.browserName)
      await (this.browser?.sessionId ? this.browser?.deleteSession?.() : null)
      throw new Error(`[vitest] The provider was closed.`)
    }
  }

  async close(): Promise<void> {
    debug?.('[%s] closing provider', this.browserName)
    this.closing = true
    const browser = this.browser
    const sessionId = browser?.sessionId
    if (!browser || !sessionId) {
      return
    }

    // https://github.com/webdriverio/webdriverio/blob/ab1a2e82b13a9c7d0e275ae87e7357e1b047d8d3/packages/wdio-runner/src/index.ts#L486
    await browser.deleteSession()
    browser.sessionId = undefined as unknown as string
    this.browser = null
  }

  async getCDPSession(_sessionId: string): Promise<CDPSession> {
    return {
      send: (method: string, params: any) => {
        if (!this.browser) {
          throw new Error(`The environment was torn down.`)
        }
        return this.browser.sendCommandAndGetResult(method, params ?? {}).catch((error) => {
          return Promise.reject(new Error(`Failed to execute "${method}" command.`, { cause: error }))
        })
      },
      on: () => {
        throw new Error(`webdriverio provider doesn't support cdp.on()`)
      },
      once: () => {
        throw new Error(`webdriverio provider doesn't support cdp.once()`)
      },
      off: () => {
        throw new Error(`webdriverio provider doesn't support cdp.off()`)
      },
    }
  }
}

declare module 'vitest/browser' {
  export interface UserEventClickOptions extends Partial<ClickOptions>, SelectorOptions {}
  export interface UserEventHoverOptions extends MoveToOptions, SelectorOptions {}
  export interface UserEventDragAndDropOptions extends DragAndDropOptions {
    sourceX?: number
    sourceY?: number
    targetX?: number
    targetY?: number
  }
  export interface UserEventFillOptions extends SelectorOptions {}
  export interface UserEventSelectOptions extends SelectorOptions {}
  export interface UserEventClearOptions extends SelectorOptions {}
  export interface UserEventDoubleClickOptions extends SelectorOptions {}
  export interface UserEventTripleClickOptions extends SelectorOptions {}
  export interface UserEventWheelBaseOptions extends SelectorOptions {}
  export interface LocatorScreenshotOptions extends SelectorOptions {}
}

declare module 'vitest/node' {
  export interface BrowserCommandContext {
    browser: WebdriverIO.Browser
  }

  export interface _BrowserNames {
    webdriverio: WebdriverBrowser
  }

  export interface ToMatchScreenshotOptions
    extends Omit<
      ScreenshotMatcherOptions,
      'comparatorName' | 'comparatorOptions'
    >, CustomComparatorsRegistry {}

  export interface ToMatchScreenshotComparators
    extends ScreenshotComparatorRegistry {}
}
