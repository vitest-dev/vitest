import { page, server, userEvent } from '@vitest/browser/context'
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
import { getElementError } from '../public-utils'
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
    return new PreviewLocator(
      selectorEngine.generateSelectorSimple(element),
      element,
    )
  },
})

class PreviewLocator extends Locator {
  constructor(protected _pwSelector: string, protected _container?: Element) {
    super()
  }

  override get selector() {
    const selectors = this.elements().map(element => convertElementToCssSelector(element))
    if (!selectors.length) {
      throw getElementError(this._pwSelector, this._container || document.body)
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

  async fill(text: string): Promise<void> {
    return userEvent.fill(this.element(), text)
  }

  async upload(file: string | string[] | File | File[]): Promise<void> {
    return userEvent.upload(this.element(), file)
  }

  selectOptions(options_: string | string[] | HTMLElement | HTMLElement[] | Locator | Locator[]): Promise<void> {
    return userEvent.selectOptions(this.element(), options_)
  }

  clear(): Promise<void> {
    return userEvent.clear(this.element())
  }

  protected locator(selector: string) {
    return new PreviewLocator(`${this._pwSelector} >> ${selector}`, this._container)
  }

  protected elementLocator(element: Element) {
    return new PreviewLocator(
      selectorEngine.generateSelectorSimple(element),
      element,
    )
  }
}
