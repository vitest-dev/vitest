import { page } from '@vitest/browser/context'
import {
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
} from './playwright-utils'
import { Locator } from './index'

// TODO: type options
page.extend({
  getByLabelText(text: string | RegExp) {
    return new Locator(getByLabelSelector(text))
  },
  getByRole(role: string, options?: any) {
    return new Locator(getByRoleSelector(role, options))
  },
  getByTestId(testId: string | RegExp) {
    // TODO: custom testid attribute
    return new Locator(getByTestIdSelector('data-testid', testId))
  },
  getByAltText(text: string | RegExp) {
    return new Locator(getByAltTextSelector(text))
  },
  getByPlaceholder(text: string | RegExp) {
    return new Locator(getByPlaceholderSelector(text))
  },
  getByText(text: string | RegExp) {
    return new Locator(getByTextSelector(text))
  },
  getByTitle(title: string | RegExp) {
    return new Locator(getByTitleSelector(title))
  },
})
