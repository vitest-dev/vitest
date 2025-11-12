import type { CustomComparatorsRegistry } from '@vitest/browser'
import type { Capabilities } from '@wdio/types'
import type {
  ScreenshotComparatorRegistry,
  ScreenshotMatcherOptions,
} from 'vitest/browser'
import type {
  BrowserCommand,
  BrowserProvider,
  BrowserProviderOption,
  CDPSession,
  TestProject,
} from 'vitest/node'
import type { ClickOptions, DragAndDropOptions, MoveToOptions, remote } from 'webdriverio'
import { Buffer } from 'node:buffer'

import { defineBrowserProvider } from '@vitest/browser'
import { resolve } from 'pathe'
import { createDebugger } from 'vitest/node'
import commands from './commands'
import { distRoot } from './constants'

const debug = createDebugger('vitest:browser:wdio')

const webdriverBrowsers = ['firefox', 'chrome', 'edge', 'safari'] as const
type WebdriverBrowser = (typeof webdriverBrowsers)[number]

type SerializedRouteMatcher
  = | { type: 'string'; value: string }
    | { type: 'regexp'; value: string; flags: string }

interface RouteRegisterPayload {
  id: string
  matcher: SerializedRouteMatcher
}

interface RouteContinueOverrides {
  url?: string
  method?: string
  headers?: Record<string, string>
  postData?: string
}

interface RouteEvaluationRequest {
  url: string
  method: string
  headers: Record<string, string>
  postData?: string | null
  resourceType?: string
}

type RouteEvaluationResult
  = | { type: 'continue'; overrides?: RouteContinueOverrides }
    | { type: 'fulfill'; status?: number; headers?: Record<string, string>; body?: string; contentType?: string }
    | { type: 'abort'; errorCode?: string }

interface WebdriverRouteEntry {
  matcher: string | RegExp
  mock: WebdriverIO.Mock
}

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
  private routes: Map<string, Map<string, WebdriverRouteEntry>> = new Map()

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
    await this.browser.send({
      method: 'browsingContext.setViewport',
      params: {
        context: this.topLevelContext,
        devicePixelRatio: 1,
        viewport: options,
      },
    })
  }

  getCommandsContext(): {
    browser: WebdriverIO.Browser | null
  } {
    return {
      browser: this.browser,
    }
  }

  private getSessionRouteMap(sessionId: string): Map<string, WebdriverRouteEntry> {
    let routes = this.routes.get(sessionId)
    if (!routes) {
      routes = new Map()
      this.routes.set(sessionId, routes)
    }
    return routes
  }

  private deserializeMatcher(matcher: SerializedRouteMatcher): string | RegExp {
    if (matcher.type === 'string') {
      return matcher.value
    }
    if (matcher.type === 'regexp') {
      return new RegExp(matcher.value, matcher.flags)
    }
    throw new Error(`Unsupported route matcher type "${(matcher as any)?.type}".`)
  }

  private normalizeHeaders(headers: any): Record<string, string> {
    const normalized: Record<string, string> = {}
    if (!headers) {
      return normalized
    }
    if (Array.isArray(headers)) {
      for (const header of headers) {
        if (!header) {
          continue
        }
        const name = header.name ?? header.key
        if (!name) {
          continue
        }
        const value = Array.isArray(header.value)
          ? header.value.join(', ')
          : header.value ?? header.values
        if (value == null) {
          continue
        }
        normalized[name] = String(value)
      }
      return normalized
    }
    if (typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        if (value == null) {
          continue
        }
        normalized[key] = Array.isArray(value) ? value.join(', ') : String(value)
      }
    }
    return normalized
  }

  private extractBody(body: any): string | null {
    if (!body) {
      return null
    }
    if (typeof body === 'string') {
      return body
    }
    if (typeof body.text === 'string') {
      return body.text
    }
    if (typeof body.value === 'string') {
      return body.value
    }
    if (typeof body.data === 'string') {
      return body.data
    }
    if (typeof body.bytes === 'string') {
      try {
        return Buffer.from(body.bytes, 'base64').toString()
      }
      catch {
        return null
      }
    }
    return null
  }

  private toRouteRequest(event: any): RouteEvaluationRequest {
    const request = (event && event.request) || {}
    const url = typeof request.url === 'string' ? request.url : ''
    const method = typeof request.method === 'string' ? request.method : 'GET'
    const headers = this.normalizeHeaders(request.headers)
    const postData = this.extractBody(request.body)
    const resourceType = typeof request.initiator?.type === 'string'
      ? request.initiator.type
      : (typeof request.resourceType === 'string' ? request.resourceType : undefined)
    return {
      url,
      method,
      headers,
      postData,
      resourceType,
    }
  }

  private async evaluateRouteHandler(
    sessionId: string,
    routeId: string,
    request: RouteEvaluationRequest,
  ): Promise<RouteEvaluationResult> {
    const browser = await this.openBrowser()
    try {
      const result = await browser.execute(
        (id: string, payload: RouteEvaluationRequest) => {
          const handler = (window as any).__vitest_handleRoute
          if (!handler) {
            return { type: 'continue' }
          }
          return handler(id, payload)
        },
        routeId,
        request,
      )
      if (!result || typeof result !== 'object') {
        return { type: 'continue' }
      }
      return result as RouteEvaluationResult
    }
    catch (error) {
      debug?.('[%s] route handler execution failed: %O', sessionId, error)
      return { type: 'continue' }
    }
  }

  private applyMockResult(mock: WebdriverIO.Mock, result: RouteEvaluationResult) {
    if (result.type === 'fulfill') {
      const options: Record<string, any> = {}
      if (result.status != null) {
        options.statusCode = result.status
      }
      if (result.headers) {
        options.headers = result.headers
      }
      if (result.contentType) {
        options.headers ??= {}
        options.headers['content-type'] = result.contentType
      }
      mock.respondOnce(result.body ?? '', options)
      return
    }

    if (result.type === 'abort') {
      mock.abortOnce()
      return
    }

    const overrides = result.overrides
    if (overrides) {
      mock.requestOnce({
        url: overrides.url,
        method: overrides.method as any,
        headers: overrides.headers,
        body: overrides.postData,
      })
    }
  }

  private async handleMockRequest(
    sessionId: string,
    routeId: string,
    mock: WebdriverIO.Mock,
    event: any,
  ) {
    try {
      const request = this.toRouteRequest(event)
      const result = await this.evaluateRouteHandler(sessionId, routeId, request)
      this.applyMockResult(mock, result)
    }
    catch (error) {
      debug?.('[%s] failed to process network mock: %O', sessionId, error)
    }
  }

  public async registerRoute(sessionId: string, payload: RouteRegisterPayload): Promise<void> {
    const routes = this.getSessionRouteMap(sessionId)
    if (routes.has(payload.id)) {
      await this.unregisterRoute(sessionId, payload.id)
    }
    const matcher = this.deserializeMatcher(payload.matcher)
    const browser = await this.openBrowser()
    if (typeof browser.mock !== 'function') {
      throw new TypeError('This WebDriverIO setup does not support network interception. Ensure WebDriver BiDi is available.')
    }
    const mock = await browser.mock(matcher as any)
    mock.on('request', (event) => {
      void this.handleMockRequest(sessionId, payload.id, mock, event)
    })
    routes.set(payload.id, { matcher, mock })
  }

  public async unregisterRoute(sessionId: string, routeId: string): Promise<void> {
    const routes = this.routes.get(sessionId)
    if (!routes) {
      return
    }
    const entry = routes.get(routeId)
    if (!entry) {
      return
    }
    routes.delete(routeId)
    try {
      await entry.mock.restore()
    }
    catch (error) {
      debug?.('[%s] failed to restore mock: %O', sessionId, error)
    }
    if (!routes.size) {
      this.routes.delete(sessionId)
    }
  }

  public async resetRoutes(sessionId: string): Promise<void> {
    const routes = this.routes.get(sessionId)
    if (!routes?.size) {
      return
    }
    await Promise.all(
      [...routes.values()].map(async (entry) => {
        try {
          await entry.mock.restore()
        }
        catch (error) {
          debug?.('[%s] failed to restore mock: %O', sessionId, error)
        }
      }),
    )
    routes.clear()
    this.routes.delete(sessionId)
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
      args.push(`--remote-debugging-address=${host}`)

      this.project.vitest.logger.log(`Debugger listening on ws://${host}:${port}`)

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
      this.routes.clear()
      return
    }

    await Promise.all([...this.routes.keys()].map(id => this.resetRoutes(id))).catch((error) => {
      debug?.('[%s] failed to reset routes during teardown: %O', this.browserName, error)
    })
    this.routes.clear()

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
  export interface UserEventClickOptions extends Partial<ClickOptions> {}
  export interface UserEventHoverOptions extends MoveToOptions {}

  export interface UserEventDragAndDropOptions extends DragAndDropOptions {
    sourceX?: number
    sourceY?: number
    targetX?: number
    targetY?: number
  }
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
