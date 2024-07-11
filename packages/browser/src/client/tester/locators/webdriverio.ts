import { page } from '@vitest/browser/context'
import {
  getByAltText,
  getByLabelText,
  getByPlaceholderText,
  getByRole,
  getByTestId,
  getByText,
  getByTitle,
} from '@testing-library/dom'
import { convertElementToCssSelector } from '../../utils'
import { Locator } from './index'

page.extend({
  getByLabelText(text: string | RegExp, options) {
    return new WebdriverIOLocator(getByLabelText(document.body, text, options))
  },
  getByRole(role: string, options) {
    return new WebdriverIOLocator(getByRole(document.body, role, options))
  },
  getByTestId(testId: string | RegExp) {
    return new WebdriverIOLocator(getByTestId(document.body, testId))
  },
  getByAltText(text: string | RegExp, options) {
    return new WebdriverIOLocator(getByAltText(document.body, text, options))
  },
  getByPlaceholder(text: string | RegExp, options) {
    return new WebdriverIOLocator(getByPlaceholderText(document.body, text, options))
  },
  getByText(text: string | RegExp, options) {
    return new WebdriverIOLocator(getByText(document.body, text, options))
  },
  getByTitle(title: string | RegExp, options) {
    return new WebdriverIOLocator(getByTitle(document.body, title, options))
  },

  elementLocator(element: Element) {
    return new WebdriverIOLocator(element)
  },
})

class WebdriverIOLocator extends Locator {
  private _element: HTMLElement

  constructor(element: Element) {
    super(convertElementToCssSelector(element))
    this._element = element as HTMLElement
  }

  getByRole(role: string): Locator {
    return new WebdriverIOLocator(getByRole(this._element, role))
  }

  getByAltText(text: string | RegExp): Locator {
    return new WebdriverIOLocator(getByAltText(this._element, text))
  }

  getByLabelText(text: string | RegExp): Locator {
    return new WebdriverIOLocator(getByLabelText(this._element, text))
  }

  getByPlaceholder(text: string | RegExp): Locator {
    return new WebdriverIOLocator(getByPlaceholderText(this._element, text))
  }

  getByText(text: string | RegExp): Locator {
    return new WebdriverIOLocator(getByText(this._element, text))
  }

  getByTestId(testId: string | RegExp): Locator {
    return new WebdriverIOLocator(getByTestId(this._element, testId))
  }

  getByTitle(title: string | RegExp): Locator {
    return new WebdriverIOLocator(getByTitle(this._element, title))
  }

  public element() {
    return this._element
  }
}
