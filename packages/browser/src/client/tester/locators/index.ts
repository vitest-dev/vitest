import type {
  LocatorByRoleOptions,
  LocatorOptions,
  LocatorScreenshotOptions,
  UserEventClickOptions,
  UserEventDragAndDropOptions,
  UserEventFillOptions,
  UserEventHoverOptions,
} from '@vitest/browser/context'
import { page, server } from '@vitest/browser/context'
import type { BrowserRPC } from '@vitest/browser/client'
import {
  Ivya,
  type ParsedSelector,
  asLocator,
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
} from 'ivya'
import type { WorkerGlobalState } from 'vitest'
import type { BrowserRunnerState } from '../../utils'
import { getBrowserState, getWorkerState } from '../../utils'

// we prefer using playwright locators because they are more powerful and support Shadow DOM
export const selectorEngine = Ivya.create({
  browser: ((name: string) => {
    switch (name) {
      case 'edge':
      case 'chrome':
        return 'chromium'
      case 'safari':
        return 'webkit'
      default:
        return name as 'webkit' | 'firefox' | 'chromium'
    }
  })(server.config.browser.name),
  testIdAttribute: server.config.browser.locators.testIdAttribute,
})

export abstract class Locator {
  public abstract selector: string

  private _parsedSelector: ParsedSelector | undefined
  protected _pwSelector?: string | undefined
  protected _forceElement?: Element | undefined

  public click(options: UserEventClickOptions = {}): Promise<void> {
    return this.triggerCommand<void>('__vitest_click', this.selector, options)
  }

  public dblClick(options: UserEventClickOptions = {}): Promise<void> {
    return this.triggerCommand<void>('__vitest_dblClick', this.selector, options)
  }

  public tripleClick(options: UserEventClickOptions = {}): Promise<void> {
    return this.triggerCommand<void>('__vitest_tripleClick', this.selector, options)
  }

  public clear(): Promise<void> {
    return this.triggerCommand<void>('__vitest_clear', this.selector)
  }

  public hover(options: UserEventHoverOptions): Promise<void> {
    return this.triggerCommand<void>('__vitest_hover', this.selector, options)
  }

  public unhover(options: UserEventHoverOptions): Promise<void> {
    return this.triggerCommand<void>('__vitest_hover', 'html > body', options)
  }

  public fill(text: string, options?: UserEventFillOptions): Promise<void> {
    return this.triggerCommand<void>('__vitest_fill', this.selector, text, options)
  }

  public dropTo(target: Locator, options: UserEventDragAndDropOptions = {}): Promise<void> {
    return this.triggerCommand<void>(
      '__vitest_dragAndDrop',
      this.selector,
      target.selector,
      options,
    )
  }

  public selectOptions(value: HTMLElement | HTMLElement[] | string | string[]): Promise<void> {
    const values = (Array.isArray(value) ? value : [value]).map((v) => {
      if (typeof v !== 'string') {
        const selector = selectorEngine.generateSelectorSimple(v)
        return { element: selector }
      }
      return v
    })
    return this.triggerCommand('__vitest_selectOptions', this.selector, values)
  }

  public screenshot(options: Omit<LocatorScreenshotOptions, 'base64'> & { base64: true }): Promise<{
    path: string
    base64: string
  }>
  public screenshot(options?: LocatorScreenshotOptions): Promise<string>
  public screenshot(options?: LocatorScreenshotOptions): Promise<string | {
    path: string
    base64: string
  }> {
    return page.screenshot({
      ...options,
      element: this,
    })
  }

  protected abstract locator(selector: string): Locator
  protected abstract elementLocator(element: Element): Locator

  public getByRole(role: string, options?: LocatorByRoleOptions): Locator {
    return this.locator(getByRoleSelector(role, options))
  }

  public getByAltText(text: string | RegExp, options?: LocatorOptions): Locator {
    return this.locator(getByAltTextSelector(text, options))
  }

  public getByLabelText(text: string | RegExp, options?: LocatorOptions): Locator {
    return this.locator(getByLabelSelector(text, options))
  }

  public getByPlaceholder(text: string | RegExp, options?: LocatorOptions): Locator {
    return this.locator(getByPlaceholderSelector(text, options))
  }

  public getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector(server.config.browser.locators.testIdAttribute, testId))
  }

  public getByText(text: string | RegExp, options?: LocatorOptions): Locator {
    return this.locator(getByTextSelector(text, options))
  }

  public getByTitle(title: string | RegExp, options?: LocatorOptions): Locator {
    return this.locator(getByTitleSelector(title, options))
  }

  public query(): Element | null {
    if (this._forceElement) {
      return this._forceElement
    }
    const parsedSelector = this._parsedSelector || (this._parsedSelector = selectorEngine.parseSelector(this._pwSelector || this.selector))
    return selectorEngine.querySelector(parsedSelector, document.body, true)
  }

  public element(): Element {
    const element = this.query()
    if (!element) {
      throw new Error(`element not found: ${asLocator('javascript', this._pwSelector || this.selector)}`)
    }
    return element
  }

  public elements(): Element[] {
    if (this._forceElement) {
      return [this._forceElement]
    }
    const parsedSelector = this._parsedSelector || (this._parsedSelector = selectorEngine.parseSelector(this._pwSelector || this.selector))
    return selectorEngine.querySelectorAll(parsedSelector, document.body)
  }

  public all(): Locator[] {
    return this.elements().map(element => this.elementLocator(element))
  }

  private get state(): BrowserRunnerState {
    return getBrowserState()
  }

  private get worker(): WorkerGlobalState {
    return getWorkerState()
  }

  private get rpc(): BrowserRPC {
    return this.worker.rpc as any as BrowserRPC
  }

  protected triggerCommand<T>(command: string, ...args: any[]) {
    const filepath = this.worker.filepath
      || this.worker.current?.file?.filepath
      || undefined

    return this.rpc.triggerCommand<T>(
      this.state.contextId,
      command,
      filepath,
      args,
    )
  }
}
