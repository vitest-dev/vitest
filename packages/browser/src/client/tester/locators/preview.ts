import {
  getByAltText,
  getByLabelText,
  getByPlaceholderText,
  getByRole,
  getByTestId,
  getByText,
  getByTitle,
} from '@testing-library/dom'
import type { Locator } from '@vitest/browser/context'
import { page } from '@vitest/browser/context'
import type { UserEvent } from '@testing-library/user-event'
import { userEvent } from '@testing-library/user-event'
import { convertElementToCssSelector } from '../../utils'

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

class PreviewLocator implements Locator {
  public selector: string
  private _element: HTMLElement
  private _userEvent: UserEvent

  constructor(element: Element) {
    this.selector = convertElementToCssSelector(element)
    this._element = element as HTMLElement
    this._userEvent = userEvent.setup({
      document: this._element.ownerDocument,
    })
  }

  click(): Promise<void> {
    return this._userEvent.click(this._element)
  }

  dblClick(): Promise<void> {
    return this._userEvent.dblClick(this._element)
  }

  tripleClick(): Promise<void> {
    return this._userEvent.tripleClick(this._element)
  }

  hover(): Promise<void> {
    return this._userEvent.hover(this._element)
  }

  unhover(): Promise<void> {
    return this._userEvent.unhover(this._element)
  }

  fill(text: string): Promise<void> {
    return this._userEvent.type(this._element, text)
  }

  dropTo(): Promise<void> {
    throw new Error('The "preview" provider doesn\'t support `dropTo` method.')
  }

  clear(): Promise<void> {
    return this._userEvent.clear(this._element)
  }

  async screenshot(): Promise<never> {
    throw new Error('The "preview" provider doesn\'t support `screenshot` method.')
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

  public element() {
    return this._element
  }
}
