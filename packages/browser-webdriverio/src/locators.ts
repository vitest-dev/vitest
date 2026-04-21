import type {
  LocatorScreenshotOptions,
  UserEventClearOptions,
  UserEventClickOptions,
  UserEventDragAndDropOptions,
  UserEventFillOptions,
  UserEventHoverOptions,
  UserEventSelectOptions,
  UserEventWheelOptions,
} from 'vitest/browser'
import {
  convertElementToCssSelector,
  ensureAwaited,
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
  getIframeScale,
  Locator,
  selectorEngine,
  triggerCommandWithTrace,
} from '@vitest/browser/locators'
import { page, server, utils } from 'vitest/browser'
import { __INTERNAL } from 'vitest/internal/browser'

class WebdriverIOLocator extends Locator {
  constructor(protected _pwSelector: string, protected _container?: Element) {
    super()
  }

  // This exists to avoid calling `this.elements` in `this.selector`'s getter in interactive actions
  private withElement(element: Element, error: Error | undefined) {
    const pwSelector = selectorEngine.generateSelectorSimple(element)
    const cssSelector = convertElementToCssSelector(element)
    return new ElementWebdriverIOLocator(cssSelector, error, pwSelector, element)
  }

  override get selector(): string {
    const selectors = this.elements().map(element => convertElementToCssSelector(element))
    if (!selectors.length) {
      throw utils.getElementError(this._pwSelector, this._container || document.body)
    }
    let hasShadowRoot = false
    const newSelectors = selectors.map((selector) => {
      if (selector.startsWith('>>>')) {
        hasShadowRoot = true
        return selector.slice(3)
      }
      return selector
    })
    return (hasShadowRoot ? '>>>' : '') + newSelectors.join(', ')
  }

  public override click(options?: UserEventClickOptions): Promise<void> {
    return ensureAwaited(async (error) => {
      const element = await this.findElement(options)
      return this.withElement(element, error).click(processClickOptions(options))
    })
  }

  public override dblClick(options?: UserEventClickOptions): Promise<void> {
    return ensureAwaited(async (error) => {
      const element = await this.findElement(options)
      return this.withElement(element, error).dblClick(processClickOptions(options))
    })
  }

  public override tripleClick(options?: UserEventClickOptions): Promise<void> {
    return ensureAwaited(async (error) => {
      const element = await this.findElement(options)
      return this.withElement(element, error).tripleClick(processClickOptions(options))
    })
  }

  public selectOptions(
    value: HTMLElement | HTMLElement[] | Locator | Locator[] | string | string[],
    options?: UserEventSelectOptions,
  ): Promise<void> {
    return ensureAwaited(async (error) => {
      const element = await this.findElement(options)
      const values = getWebdriverioSelectOptions(element, value)
      return triggerCommandWithTrace<void>({
        name: '__vitest_selectOptions',
        arguments: [convertElementToCssSelector(element), values, options],
        errorSource: error,
      })
    })
  }

  public override hover(options?: UserEventHoverOptions): Promise<void> {
    return ensureAwaited(async (error) => {
      const element = await this.findElement(options)
      return this.withElement(element, error).hover(processHoverOptions(options))
    })
  }

  public override dropTo(target: Locator, options?: UserEventDragAndDropOptions): Promise<void> {
    // playwright doesn't enforce a single element, it selects the first one,
    // so we just follow the behavior
    return super.dropTo(target, processDragAndDropOptions(options))
  }

  public override wheel(options: UserEventWheelOptions): Promise<void> {
    return ensureAwaited(async (error) => {
      const element = await this.findElement(options)
      return this.withElement(element, error).wheel(options)
    })
  }

  public override clear(options?: UserEventClearOptions): Promise<void> {
    return ensureAwaited(async (error) => {
      const element = await this.findElement(options)
      return this.withElement(element, error).clear(options)
    })
  }

  public override fill(text: string, options?: UserEventFillOptions): Promise<void> {
    return ensureAwaited(async (error) => {
      const element = await this.findElement(options)
      return this.withElement(element, error).fill(text, options)
    })
  }

  public override screenshot(options?: LocatorScreenshotOptions): Promise<any> {
    return ensureAwaited(async (error) => {
      const element = await this.findElement(options)
      return this.withElement(element, error).screenshot(options)
    })
  }

  // playwright doesn't enforce a single element in upload
  // public override async upload(): Promise<void>

  protected locator(selector: string) {
    return new WebdriverIOLocator(`${this._pwSelector} >> ${selector}`, this._container)
  }

  protected elementLocator(element: Element) {
    return new WebdriverIOLocator(selectorEngine.generateSelectorSimple(element), element)
  }
}

const kElementLocator = Symbol.for('$$vitest:locator-resolved')

class ElementWebdriverIOLocator extends Locator {
  public [kElementLocator] = true

  constructor(
    private _cssSelector: string,
    protected _errorSource: Error | undefined,
    protected _pwSelector: string,
    protected _container: Element,
  ) {
    super()
  }

  override get selector() {
    return this._cssSelector
  }

  protected locator(_selector: string): Locator {
    throw new Error(`should not be called`)
  }

  protected elementLocator(_element: Element): Locator {
    throw new Error(`should not be called`)
  }
}

page.extend({
  getByLabelText(text, options) {
    return new WebdriverIOLocator(getByLabelSelector(text, options))
  },
  getByRole(role, options) {
    return new WebdriverIOLocator(getByRoleSelector(role, options))
  },
  getByTestId(testId) {
    return new WebdriverIOLocator(getByTestIdSelector(server.config.browser.locators.testIdAttribute, testId))
  },
  getByAltText(text, options) {
    return new WebdriverIOLocator(getByAltTextSelector(text, options))
  },
  getByPlaceholder(text, options) {
    return new WebdriverIOLocator(getByPlaceholderSelector(text, options))
  },
  getByText(text, options) {
    return new WebdriverIOLocator(getByTextSelector(text, options))
  },
  getByTitle(title, options) {
    return new WebdriverIOLocator(getByTitleSelector(title, options))
  },

  elementLocator(element: Element) {
    return new WebdriverIOLocator(selectorEngine.generateSelectorSimple(element))
  },
})

__INTERNAL._createLocator = selector => new WebdriverIOLocator(selector)

function getWebdriverioSelectOptions(element: Element, value: string | string[] | HTMLElement[] | HTMLElement | Locator | Locator[]) {
  const options = [...element.querySelectorAll('option')] as HTMLOptionElement[]

  const arrayValues = Array.isArray(value) ? value : [value]

  if (!arrayValues.length) {
    return []
  }

  if (arrayValues.length > 1) {
    throw new Error('Provider "webdriverio" doesn\'t support selecting multiple values at once')
  }

  const optionValue = arrayValues[0]

  if (typeof optionValue !== 'string') {
    const element = ('element' in optionValue ? optionValue.element() : optionValue) as HTMLOptionElement
    const index = options.indexOf(element)
    if (index === -1) {
      throw new Error(`The element ${selectorEngine.previewNode(element)} was not found in the "select" options.`)
    }

    return [{ index }]
  }

  const valueIndex = options.findIndex(option => option.value === optionValue)
  if (valueIndex !== -1) {
    return [{ index: valueIndex }]
  }

  const labelIndex = options.findIndex(option =>
    option.textContent?.trim() === optionValue || option.ariaLabel === optionValue,
  )

  if (labelIndex === -1) {
    throw new Error(`The option "${optionValue}" was not found in the "select" options.`)
  }

  return [{ index: labelIndex }]
}

function processClickOptions(options?: UserEventClickOptions) {
  // only ui scales the iframe, so we need to adjust the position
  if (!options || !server.config.browser.ui) {
    return options
  }
  if (options.x != null || options.y != null) {
    const cache = {}
    if (options.x != null) {
      options.x = scaleCoordinate(options.x, cache)
    }
    if (options.y != null) {
      options.y = scaleCoordinate(options.y, cache)
    }
  }
  return options
}

function processHoverOptions(options?: UserEventHoverOptions) {
  // only ui scales the iframe, so we need to adjust the position
  if (!options || !server.config.browser.ui) {
    return options
  }
  const cache = {}
  if (options.xOffset != null) {
    options.xOffset = scaleCoordinate(options.xOffset, cache)
  }
  if (options.yOffset != null) {
    options.yOffset = scaleCoordinate(options.yOffset, cache)
  }
  return options
}

function processDragAndDropOptions(options?: UserEventDragAndDropOptions) {
  // only ui scales the iframe, so we need to adjust the position
  if (!options || !server.config.browser.ui) {
    return options
  }
  const cache = {}
  if (options.sourceX != null) {
    options.sourceX = scaleCoordinate(options.sourceX, cache)
  }
  if (options.sourceY != null) {
    options.sourceY = scaleCoordinate(options.sourceY, cache)
  }
  if (options.targetX != null) {
    options.targetX = scaleCoordinate(options.targetX, cache)
  }
  if (options.targetY != null) {
    options.targetY = scaleCoordinate(options.targetY, cache)
  }
  return options
}

function scaleCoordinate(coordinate: number, cache: any) {
  return Math.round(coordinate * getCachedScale(cache))
}

function getCachedScale(cache: { scale: number | undefined }) {
  return cache.scale ??= getIframeScale()
}
