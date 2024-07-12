import { page } from '@vitest/browser/context'
import { convertElementToCssSelector } from '../../utils'
import {
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
} from './playwright-selector/locatorUtils'
import { Locator, selectorEngine } from './index'

page.extend({
  getByLabelText(text, options) {
    return new WebdriverIOLocator(getByLabelSelector(text, options))
  },
  getByRole(role, options) {
    return new WebdriverIOLocator(getByRoleSelector(role, options))
  },
  getByTestId(testId) {
    return new WebdriverIOLocator(getByTestIdSelector(page.config.browser.locators.testIdAttribute, testId))
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

class WebdriverIOLocator extends Locator {
  constructor(protected _pwSelector: string) {
    super()
  }

  override get selector() {
    const selectors = this.elements().map(element => convertElementToCssSelector(element))
    if (!selectors.length) {
      throw new Error(`element not found: ${this._pwSelector}`)
    }
    return selectors.join(', ')
  }

  public selectOptions(value: HTMLElement | HTMLElement[] | string | string[]): Promise<void> {
    const values = getWebdriverioSelectOptions(this.element(), value)
    return this.triggerCommand('__vitest_selectOptions', this.selector, values)
  }

  locator(selector: string) {
    return new WebdriverIOLocator(`${this._pwSelector} >> ${selector}`)
  }
}

function getWebdriverioSelectOptions(element: Element, value: string | string[] | HTMLElement[] | HTMLElement) {
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
    const index = options.indexOf(optionValue as HTMLOptionElement)
    if (index === -1) {
      throw new Error(`The element ${convertElementToCssSelector(optionValue)} was not found in the "select" options.`)
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
