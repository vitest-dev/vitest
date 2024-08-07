import { page, server } from '@vitest/browser/context'
import {
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
} from 'ivya'
import { Locator, selectorEngine } from './index'

page.extend({
  getByLabelText(text, options) {
    return new PlaywrightLocator(getByLabelSelector(text, options))
  },
  getByRole(role, options) {
    return new PlaywrightLocator(getByRoleSelector(role, options))
  },
  getByTestId(testId) {
    return new PlaywrightLocator(getByTestIdSelector(server.config.browser.locators.testIdAttribute, testId))
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
    return new PlaywrightLocator(
      selectorEngine.generateSelectorSimple(element),
      element,
    )
  },
})

class PlaywrightLocator extends Locator {
  constructor(public selector: string, protected _container?: Element) {
    super()
  }

  protected locator(selector: string) {
    return new PlaywrightLocator(`${this.selector} >> ${selector}`, this._container)
  }

  protected elementLocator(element: Element) {
    return new PlaywrightLocator(
      selectorEngine.generateSelectorSimple(element),
      element,
    )
  }
}
