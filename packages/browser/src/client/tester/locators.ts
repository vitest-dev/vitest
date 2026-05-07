import type { ParsedSelector } from 'ivya'
import type {
  LocatorByRoleOptions,
  LocatorOptions,
  LocatorScreenshotOptions,
  MarkOptions,
  SelectorOptions,
  UserEventClearOptions,
  UserEventClickOptions,
  UserEventDragAndDropOptions,
  UserEventFillOptions,
  UserEventHoverOptions,
  UserEventSelectOptions,
  UserEventUploadOptions,
  UserEventWheelOptions,
} from 'vitest/browser'
import {
  asLocator,
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
  Ivya,
} from 'ivya'
import { page, server, utils } from 'vitest/browser'
import { __INTERNAL, getSafeTimers } from 'vitest/internal/browser'
import { ensureAwaited, getBrowserState, getWorkerState } from '../utils'
import { convertElementToCssSelector, escapeForTextSelector, isLocator, processTimeoutOptions, resolveUserEventWheelOptions } from './tester-utils'
import { recordBrowserTraceEntry } from './trace'

export { ensureAwaited } from '../utils'
export { convertElementToCssSelector, getIframeScale, processTimeoutOptions } from './tester-utils'
export {
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
} from 'ivya'

__INTERNAL._asLocator = asLocator

const now = Date.now
const waitForIntervals = [0, 20, 50, 100, 100, 500]

function sleep(ms: number): Promise<void> {
  const { setTimeout } = getSafeTimers()
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const selectorEngine: Ivya = Ivya.create({
  exact: server.config.browser.locators.exact,
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

getBrowserState().selectorEngine = selectorEngine

const kLocator = Symbol.for('$$vitest:locator')

export abstract class Locator {
  public abstract selector: string

  private _parsedSelector: ParsedSelector | undefined
  protected _container?: Element | undefined
  protected _pwSelector?: string | undefined
  protected _pwLocator?: string | undefined
  protected _errorSource?: Error

  constructor() {
    Object.defineProperty(this, kLocator, {
      enumerable: false,
      writable: false,
      configurable: false,
      value: kLocator,
    })
  }

  public click(options?: UserEventClickOptions): Promise<void> {
    return this.triggerCommand<void>('__vitest_click', this.serialize(), options)
  }

  public dblClick(options?: UserEventClickOptions): Promise<void> {
    return this.triggerCommand<void>('__vitest_dblClick', this.serialize(), options)
  }

  public tripleClick(options?: UserEventClickOptions): Promise<void> {
    return this.triggerCommand<void>('__vitest_tripleClick', this.serialize(), options)
  }

  public wheel(options: UserEventWheelOptions): Promise<void> {
    return ensureAwaited<void>(async (error) => {
      await getBrowserState().commands.triggerCommand<void>(
        '__vitest_wheel',
        [this.serialize(), resolveUserEventWheelOptions(options)],
        error,
      )

      const browser = getBrowserState().config.browser.name

      // looks like on Chromium the scroll event gets dispatched a frame later
      if (browser === 'chromium' || browser === 'chrome') {
        return new Promise((resolve) => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      }
    })
  }

  public clear(options?: UserEventClearOptions): Promise<void> {
    return this.triggerCommand<void>('__vitest_clear', this.serialize(), options)
  }

  public hover(options?: UserEventHoverOptions): Promise<void> {
    return this.triggerCommand<void>('__vitest_hover', this.serialize(), options)
  }

  public unhover(options?: UserEventHoverOptions): Promise<void> {
    return this.triggerCommand<void>('__vitest_hover', { selector: 'html > body', locator: 'locator(\'body\')' }, options)
  }

  public fill(text: string, options?: UserEventFillOptions): Promise<void> {
    return this.triggerCommand<void>('__vitest_fill', this.serialize(), text, options)
  }

  public upload(files: string | string[] | File | File[], options?: UserEventUploadOptions): Promise<void> {
    return ensureAwaited(async (error) => {
      const filesPromise = (Array.isArray(files) ? files : [files]).map(async (file) => {
        if (typeof file === 'string') {
          return file
        }
        const bas64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
          reader.readAsDataURL(file)
        })

        return {
          name: file.name,
          mimeType: file.type,
          // strip prefix `data:[<media-type>][;base64],`
          base64: bas64String.slice(bas64String.indexOf(',') + 1),
        }
      })
      return getBrowserState().commands.triggerCommand<void>(
        '__vitest_upload',
        [this.serialize(), await Promise.all(filesPromise), options],
        error,
      )
    })
  }

  public dropTo(target: Locator, options: UserEventDragAndDropOptions = {}): Promise<void> {
    return this.triggerCommand<void>(
      '__vitest_dragAndDrop',
      this.toJSON(),
      target.toJSON(),
      options,
    )
  }

  public selectOptions(
    value: HTMLElement | HTMLElement[] | Locator | Locator[] | string | string[],
    options?: UserEventSelectOptions,
  ): Promise<void> {
    const values = (Array.isArray(value) ? value : [value]).map((v) => {
      if (typeof v !== 'string') {
        const element: SerializedLocator = isLocator(v)
          ? v.serialize()
          : {
              selector: convertElementToCssSelector(v),
              locator: __INTERNAL._asLocator('javascript', selectorEngine.generateSelectorSimple(v)),
            }
        return { element }
      }
      return v
    })
    return this.triggerCommand('__vitest_selectOptions', this.serialize(), values, options)
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

  public mark(name: string, options?: MarkOptions): Promise<void> {
    const currentTest = getWorkerState().current
    const hasActiveTrace = !!currentTest && getBrowserState().activeTraceTaskIds.has(currentTest.id)
    const hasActiveTraceView = !!currentTest && getBrowserState().browserTraceAttempts.has(currentTest.id)
    if (!currentTest || (!hasActiveTrace && !hasActiveTraceView)) {
      return Promise.resolve()
    }
    return ensureAwaited((error) => {
      if (hasActiveTraceView) {
        recordBrowserTraceEntry(currentTest, {
          name,
          kind: 'mark',
          element: this.serialize(),
          stack: options?.stack ?? error?.stack,
        })
      }
      if (!hasActiveTrace) {
        return Promise.resolve()
      }
      return getBrowserState().commands.triggerCommand<void>(
        '__vitest_markTrace',
        [{
          name,
          element: this.serialize(),
          stack: options?.stack ?? error?.stack,
        }],
        error,
      )
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

  public filter(filter: LocatorOptions): Locator {
    const selectors = []

    if (filter?.hasText) {
      selectors.push(`internal:has-text=${escapeForTextSelector(filter.hasText, false)}`)
    }

    if (filter?.hasNotText) {
      selectors.push(`internal:has-not-text=${escapeForTextSelector(filter.hasNotText, false)}`)
    }

    if (filter?.has) {
      const locator = filter.has as Locator
      selectors.push(`internal:has=${JSON.stringify(locator._pwSelector || locator.selector)}`)
    }

    if (filter?.hasNot) {
      const locator = filter.hasNot as Locator
      selectors.push(`internal:has-not=${JSON.stringify(locator._pwSelector || locator.selector)}`)
    }

    if (!selectors.length) {
      throw new Error(`Locator.filter expects at least one filter. None provided.`)
    }

    return this.locator(selectors.join(' >> '))
  }

  public and(locator: Locator): Locator {
    return this.locator(`internal:and=${JSON.stringify(locator._pwSelector || locator.selector)}`)
  }

  public or(locator: Locator): Locator {
    return this.locator(`internal:or=${JSON.stringify(locator._pwSelector || locator.selector)}`)
  }

  public query(): HTMLElement | SVGElement | null {
    const parsedSelector = this._parsedSelector || (this._parsedSelector = selectorEngine.parseSelector(this._pwSelector || this.selector))
    return selectorEngine.querySelector(parsedSelector, document.documentElement, true) as HTMLElement | SVGElement
  }

  public element(): HTMLElement | SVGElement {
    const element = this.query()
    if (!element) {
      throw utils.getElementError(this, this._container || document.body)
    }
    return element
  }

  public elements(): (HTMLElement | SVGElement)[] {
    const parsedSelector = this._parsedSelector || (this._parsedSelector = selectorEngine.parseSelector(this._pwSelector || this.selector))
    return selectorEngine.querySelectorAll(parsedSelector, document.documentElement) as (HTMLElement | SVGElement)[]
  }

  public get length(): number {
    return this.elements().length
  }

  public all(): Locator[] {
    return this.elements().map(element => this.elementLocator(element))
  }

  public nth(index: number): Locator {
    return this.locator(`nth=${index}`)
  }

  public first(): Locator {
    return this.nth(0)
  }

  public last(): Locator {
    return this.nth(-1)
  }

  public toString(): string {
    return this.selector
  }

  public serialize(): SerializedLocator {
    return {
      selector: this.selector,
      locator: this.asLocator(),
      _pwSelector: this._pwSelector,
    }
  }

  public asLocator(): string {
    return this._pwLocator || (this._pwLocator = asLocator('javascript', this._pwSelector || this.selector))
  }

  public toJSON(): SerializedLocator {
    return this.serialize()
  }

  public async findElement(options_: SelectorOptions = {}): Promise<HTMLElement | SVGElement> {
    const options = processTimeoutOptions(options_)
    const timeout = options?.timeout
    const strict = options?.strict ?? true
    const startTime = now()
    let intervalIndex = 0
    while (true) {
      const elements = this.elements()
      if (elements.length === 1) {
        return elements[0]
      }
      if (elements.length > 1) {
        if (strict) {
          throw createStrictModeViolationError(this, elements)
        }
        return elements[0]
      }
      const elapsed = now() - startTime
      const isLastCall = timeout != null && elapsed >= timeout
      if (isLastCall) {
        throw utils.getElementError(this, this._container || document.body)
      }
      const interval = waitForIntervals[Math.min(intervalIndex++, waitForIntervals.length - 1)]
      const nextInterval = timeout != null
        ? Math.min(interval, timeout - elapsed)
        : interval
      await sleep(nextInterval)
    }
  }

  protected triggerCommand<T>(command: string, ...args: any[]): Promise<T> {
    if (this._errorSource) {
      return triggerCommandWithTrace<T>({
        name: command,
        arguments: args,
        errorSource: this._errorSource,
      })
    }
    return ensureAwaited(error => triggerCommandWithTrace<T>({
      name: command,
      arguments: args,
      errorSource: error,
    }))
  }
}

export function triggerCommandWithTrace<T>(
  options: {
    name: string
    arguments: unknown[]
    errorSource?: Error | undefined
  },
): Promise<T> {
  return getBrowserState().commands.triggerCommand<T>(
    options.name,
    options.arguments,
    options.errorSource,
  )
}

export interface SerializedLocator {
  selector: string
  locator: string
  /**
   * @internal
   */
  _pwSelector?: string
}

function createStrictModeViolationError(
  locator: Locator,
  matches: Element[],
) {
  const infos = matches.slice(0, 10).map(m => ({
    preview: selectorEngine.previewNode(m),
    selector: selectorEngine.generateSelectorSimple(m),
  }))
  const lines = infos.map(
    (info, i) =>
      `\n    ${i + 1}) ${info.preview} aka ${asLocator('javascript', info.selector)}`,
  )
  if (infos.length < matches.length) {
    lines.push('\n    ...')
  }
  return new Error(
    `strict mode violation: ${locator.asLocator()} resolved to ${matches.length} elements:${lines.join('')}\n`,
  )
}
