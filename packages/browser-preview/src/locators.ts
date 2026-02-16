import {
  convertElementToCssSelector,
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
  Locator,
  selectorEngine,
} from '@vitest/browser/locators'
import { page, server, userEvent, utils } from 'vitest/browser'
import { __INTERNAL } from 'vitest/internal/browser'

class PreviewLocator extends Locator {
  constructor(protected _pwSelector: string, protected _container?: Element) {
    super()
  }

  override get selector() {
    const selectors = this.elements().map(element => convertElementToCssSelector(element))
    if (!selectors.length) {
      throw utils.getElementError(this._pwSelector, this._container || document.body)
    }
    return selectors.join(', ')
  }

  async click(): Promise<void> {
    const element = await this.waitForElement()
    return userEvent.click(element)
  }

  async dblClick(): Promise<void> {
    const element = await this.waitForElement()
    return userEvent.dblClick(element)
  }

  async tripleClick(): Promise<void> {
    const element = await this.waitForElement()
    return userEvent.tripleClick(element)
  }

  async hover(): Promise<void> {
    const element = await this.waitForElement()
    return userEvent.hover(element)
  }

  async unhover(): Promise<void> {
    const element = await this.waitForElement()
    return userEvent.unhover(element)
  }

  async fill(text: string): Promise<void> {
    const element = await this.waitForElement()
    return userEvent.fill(element, text)
  }

  async upload(file: string | string[] | File | File[]): Promise<void> {
    const element = await this.waitForElement()
    return userEvent.upload(element, file)
  }

  async selectOptions(options: string | string[] | HTMLElement | HTMLElement[] | Locator | Locator[]): Promise<void> {
    const element = await this.waitForElement()
    return userEvent.selectOptions(element, options)
  }

  async clear(): Promise<void> {
    const element = await this.waitForElement()
    return userEvent.clear(element)
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

__INTERNAL._createLocator = selector => new PreviewLocator(selector)
