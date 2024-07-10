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
} from './playwright-utils'
import { Locator } from './index'

// TODO: type options
page.extend({
  getByLabelText(text: string | RegExp) {
    return new PlaywrightLocator(getByLabelSelector(text))
  },
  getByRole(role: string, options?: any) {
    return new PlaywrightLocator(getByRoleSelector(role, options))
  },
  getByTestId(testId: string | RegExp) {
    // TODO: custom testid attribute
    return new PlaywrightLocator(getByTestIdSelector('data-testid', testId))
  },
  getByAltText(text: string | RegExp) {
    return new PlaywrightLocator(getByAltTextSelector(text))
  },
  getByPlaceholder(text: string | RegExp) {
    return new PlaywrightLocator(getByPlaceholderSelector(text))
  },
  getByText(text: string | RegExp) {
    return new PlaywrightLocator(getByTextSelector(text))
  },
  getByTitle(title: string | RegExp) {
    return new PlaywrightLocator(getByTitleSelector(title))
  },

  elementLocator(element: Element) {
    return new PlaywrightLocator(convertElementToCssSelector(element))
  },
})

class PlaywrightLocator extends Locator {
  constructor(selector: string) {
    super(selector)
  }

  getByRole(role: string, options?: any): Locator {
    return this.locator(getByRoleSelector(role, options))
  }

  getByAltText(text: string | RegExp): Locator {
    return this.locator(getByAltTextSelector(text))
  }

  getByLabelText(text: string | RegExp): Locator {
    return this.locator(getByLabelSelector(text))
  }

  getByPlaceholder(text: string | RegExp): Locator {
    return this.locator(getByPlaceholderSelector(text))
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector('data-testid', testId))
  }

  getByText(text: string | RegExp): Locator {
    return this.locator(getByTextSelector(text))
  }

  getByTitle(title: string | RegExp): Locator {
    return this.locator(getByTitleSelector(title))
  }

  private locator(selector: string) {
    return new PlaywrightLocator(`${this.selector} >> ${selector}`)
  }
}
