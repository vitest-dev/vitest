import { page, server } from '@vitest/browser/context'
import { userEvent } from '@testing-library/user-event'
import {
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
} from 'ivya'
import { convertElementToCssSelector } from '../../utils'
import { Locator, selectorEngine } from './index'

page.extend({
  getByLabelText(text, options) {
    return new PreviewLocator(getByLabelSelector(text, options))
  },
  getByRole(role, options) {
    return new PreviewLocator(getByRoleSelector(role, options))
  },
  getByTestId(testId) {
    return new PreviewLocator(getByTestIdSelector(server.config.browser.locators.testIdAttribute, testId))
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
    return new PreviewLocator(selectorEngine.generateSelectorSimple(element), element)
  },
})

class PreviewLocator extends Locator {
  constructor(protected _pwSelector: string, protected _forceElement?: Element) {
    super()
  }

  override get selector() {
    const selectors = this.elements().map(element => convertElementToCssSelector(element))
    if (!selectors.length) {
      throw new Error(`element not found: ${this._pwSelector}`)
    }
    return selectors.join(', ')
  }

  click(): Promise<void> {
    return userEvent.click(this.element())
  }

  dblClick(): Promise<void> {
    return userEvent.dblClick(this.element())
  }

  tripleClick(): Promise<void> {
    return userEvent.tripleClick(this.element())
  }

  hover(): Promise<void> {
    return userEvent.hover(this.element())
  }

  unhover(): Promise<void> {
    return userEvent.unhover(this.element())
  }

  fill(text: string): Promise<void> {
    return userEvent.type(this.element(), text)
  }

  selectOptions(options_: string | string[] | HTMLElement | HTMLElement[] | Locator | Locator[]): Promise<void> {
    const options = (Array.isArray(options_) ? options_ : [options_]).map((option) => {
      if (typeof option !== 'string' && 'element' in option) {
        return option.element() as HTMLElement
      }
      return option
    })
    return userEvent.selectOptions(this.element(), options as string[] | HTMLElement[])
  }

  async dropTo(): Promise<void> {
    throw new Error('The "preview" provider doesn\'t support `dropTo` method.')
  }

  clear(): Promise<void> {
    return userEvent.clear(this.element())
  }

  async screenshot(): Promise<never> {
    throw new Error('The "preview" provider doesn\'t support `screenshot` method.')
  }

  protected locator(selector: string) {
    return new PreviewLocator(`${this._pwSelector} >> ${selector}`)
  }

  protected elementLocator(element: Element) {
    return new PreviewLocator(selectorEngine.generateSelectorSimple(element), element)
  }
}
