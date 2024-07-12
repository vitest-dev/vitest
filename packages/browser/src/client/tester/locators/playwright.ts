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
import { Locator } from './index'

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

export class PlaywrightLocator extends Locator {
  constructor(public selector: string) {
    super()
  }

  protected locator(selector: string) {
    return new PlaywrightLocator(`${this.selector} >> ${selector}`)
  }
}
