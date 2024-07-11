import type { LocatorByRoleOptions, LocatorOptions } from '@vitest/browser/context'
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
import { PlaywrightSelector } from './playwright-selector/selector'
import type { ParsedSelector } from './playwright-selector/selectorParser'
import { parseSelector } from './playwright-selector/selectorParser'
import { Locator } from './index'

const selector = new PlaywrightSelector()

page.extend({
  getByLabelText(text, options) {
    return new PlaywrightLocator(getByLabelSelector(text, options))
  },
  getByRole(role, options) {
    return new PlaywrightLocator(getByRoleSelector(role, options))
  },
  getByTestId(testId) {
    // TODO: custom testid attribute
    return new PlaywrightLocator(getByTestIdSelector('data-testid', testId))
  },
  getByAltText(text, options) {
    return new PlaywrightLocator(getByAltTextSelector(text, options))
  },
  getByPlaceholder(text, options) {
    return new PlaywrightLocator(getByPlaceholderSelector(text, options))
  },
  getByText(text, options) {
    return new PlaywrightLocator(getByTextSelector(text, options))
  },
  getByTitle(title, options) {
    return new PlaywrightLocator(getByTitleSelector(title, options))
  },

  elementLocator(element: Element) {
    return new PlaywrightLocator(convertElementToCssSelector(element))
  },
})

class PlaywrightLocator extends Locator {
  private _parsedSelector: ParsedSelector | undefined

  constructor(selector: string) {
    super(selector)
  }

  getByRole(role: string, options?: LocatorByRoleOptions): Locator {
    return this.locator(getByRoleSelector(role, options))
  }

  getByAltText(text: string | RegExp, options?: LocatorOptions): Locator {
    return this.locator(getByAltTextSelector(text, options))
  }

  getByLabelText(text: string | RegExp, options?: LocatorOptions): Locator {
    return this.locator(getByLabelSelector(text, options))
  }

  getByPlaceholder(text: string | RegExp, options?: LocatorOptions): Locator {
    return this.locator(getByPlaceholderSelector(text, options))
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector('data-testid', testId))
  }

  getByText(text: string | RegExp, options?: LocatorOptions): Locator {
    return this.locator(getByTextSelector(text, options))
  }

  getByTitle(title: string | RegExp, options?: LocatorOptions): Locator {
    return this.locator(getByTitleSelector(title, options))
  }

  private locator(selector: string) {
    return new PlaywrightLocator(`${this.selector} >> ${selector}`)
  }

  public element() {
    const parsedSelector = this._parsedSelector || (this._parsedSelector = parseSelector(this.selector))
    return selector.querySelector(parsedSelector, document.body, true)
  }

  public elements() {
    const parsedSelector = this._parsedSelector || (this._parsedSelector = parseSelector(this.selector))
    return selector.querySelectorAll(parsedSelector, document.body)
  }
}
