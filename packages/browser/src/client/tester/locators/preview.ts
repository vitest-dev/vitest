import { page } from '@vitest/browser/context'
import type { UserEvent } from '@testing-library/user-event'
import { userEvent } from '@testing-library/user-event'
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
    return new PreviewLocator(getByLabelSelector(text, options))
  },
  getByRole(role, options) {
    return new PreviewLocator(getByRoleSelector(role, options))
  },
  getByTestId(testId) {
    return new PreviewLocator(getByTestIdSelector(page.config.browser.locators.testIdAttribute, testId))
  },
  getByAltText(text, options) {
    return new PreviewLocator(getByAltTextSelector(text, options))
  },
  getByPlaceholder(text, options) {
    return new PreviewLocator(getByPlaceholderSelector(text, options))
  },
  getByText(text, options) {
    return new PreviewLocator(getByTextSelector(text, options))
  },
  getByTitle(title, options) {
    return new PreviewLocator(getByTitleSelector(title, options))
  },

  elementLocator(element: Element) {
    return new PreviewLocator(convertElementToCssSelector(element), element)
  },
})

class PreviewLocator extends Locator {
  private _userEvent: UserEvent

  constructor(protected _pwSelector: string, protected _forceElement?: Element) {
    super()
    this._userEvent = userEvent.setup()
  }

  override get selector() {
    const selectors = this.elements().map(element => convertElementToCssSelector(element))
    if (!selectors.length) {
      throw new Error(`element not found: ${this._pwSelector}`)
    }
    return selectors.join(', ')
  }

  click(): Promise<void> {
    return this._userEvent.click(this.element())
  }

  dblClick(): Promise<void> {
    return this._userEvent.dblClick(this.element())
  }

  tripleClick(): Promise<void> {
    return this._userEvent.tripleClick(this.element())
  }

  hover(): Promise<void> {
    return this._userEvent.hover(this.element())
  }

  unhover(): Promise<void> {
    return this._userEvent.unhover(this.element())
  }

  fill(text: string): Promise<void> {
    return this._userEvent.type(this.element(), text)
  }

  async dropTo(): Promise<void> {
    throw new Error('The "preview" provider doesn\'t support `dropTo` method.')
  }

  clear(): Promise<void> {
    return this._userEvent.clear(this.element())
  }

  async screenshot(): Promise<never> {
    throw new Error('The "preview" provider doesn\'t support `screenshot` method.')
  }

  protected locator(selector: string) {
    return new PreviewLocator(`${this._pwSelector} >> ${selector}`)
  }
}
