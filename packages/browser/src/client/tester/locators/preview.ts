import {
  getByAltText,
  getByLabelText,
  getByPlaceholderText,
  getByRole,
  getByTestId,
  getByText,
  getByTitle,
} from '@testing-library/dom'
import { page } from '@vitest/browser/context'
import { convertElementToCssSelector } from '../../utils'
import { Locator } from './index'

// TODO: type options
page.extend({
  getByLabelText(text: string | RegExp) {
    return new PreviewLocator(getByLabelText(document.body, text))
  },
  getByRole(role: string, options?: any) {
    return new PreviewLocator(getByRole(document.body, role, options))
  },
  getByTestId(testId: string | RegExp) {
    return new PreviewLocator(getByTestId(document.body, testId))
  },
  getByAltText(text: string | RegExp) {
    return new PreviewLocator(getByAltText(document.body, text))
  },
  getByPlaceholder(text: string | RegExp) {
    return new PreviewLocator(getByPlaceholderText(document.body, text))
  },
  getByText(text: string | RegExp) {
    return new PreviewLocator(getByText(document.body, text))
  },
  getByTitle(title: string | RegExp) {
    return new PreviewLocator(getByTitle(document.body, title))
  },

  elementLocator(element: Element) {
    return new PreviewLocator(element)
  },
})

class PreviewLocator extends Locator {
  private _element: HTMLElement

  constructor(element: Element) {
    super(convertElementToCssSelector(element))
    this._element = element as HTMLElement
  }

  getByRole(role: string): Locator {
    return new PreviewLocator(getByRole(this._element, role))
  }

  getByAltText(text: string | RegExp): Locator {
    return new PreviewLocator(getByAltText(this._element, text))
  }

  getByLabelText(text: string | RegExp): Locator {
    return new PreviewLocator(getByLabelText(this._element, text))
  }

  getByPlaceholder(text: string | RegExp): Locator {
    return new PreviewLocator(getByPlaceholderText(this._element, text))
  }

  getByText(text: string | RegExp): Locator {
    return new PreviewLocator(getByText(this._element, text))
  }

  getByTestId(testId: string | RegExp): Locator {
    return new PreviewLocator(getByTestId(this._element, testId))
  }

  getByTitle(title: string | RegExp): Locator {
    return new PreviewLocator(getByTitle(this._element, title))
  }
}
