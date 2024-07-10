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
  private element: HTMLElement

  constructor(element: Element) {
    super(convertElementToCssSelector(element))
    this.element = element as HTMLElement
  }

  getByRole(role: string): Locator {
    return new PreviewLocator(getByRole(this.element, role))
  }

  getByAltText(text: string | RegExp): Locator {
    return new PreviewLocator(getByAltText(this.element, text))
  }

  getByLabelText(text: string | RegExp): Locator {
    return new PreviewLocator(getByLabelText(this.element, text))
  }

  getByPlaceholder(text: string | RegExp): Locator {
    return new PreviewLocator(getByPlaceholderText(this.element, text))
  }

  getByText(text: string | RegExp): Locator {
    return new PreviewLocator(getByText(this.element, text))
  }

  getByTestId(testId: string | RegExp): Locator {
    return new PreviewLocator(getByTestId(this.element, testId))
  }

  getByTitle(title: string | RegExp): Locator {
    return new PreviewLocator(getByTitle(this.element, title))
  }
}
