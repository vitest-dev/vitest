import type { MatchersObject } from '@vitest/expect'
import toBeChecked from './toBeChecked'
import toBeDisabled from './toBeDisabled'
import toBeEmptyDOMElement from './toBeEmptyDOMElement'
import toBeEnabled from './toBeEnabled'
import toBeInTheDocument from './toBeInTheDocument'
import toBePartiallyChecked from './toBePartiallyChecked'
import toBeVisible from './toBeVisible'
import toContainElement from './toContainElement'
import toContainHTML from './toContainHTML'
import toHaveAccessibleName from './toHaveAccessibleName'
import toHaveAttribute from './toHaveAttribute'
import toHaveDisplayValue from './toHaveDisplayValue'
import toHaveFocus from './toHaveFocus'
import toHaveFormValues from './toHaveFormValues'
import toHaveRole from './toHaveRole'
import toHaveTextContent from './toHaveTextContent'
import toHaveValue from './toHaveValue'

export const matchers: MatchersObject = {
  toBeDisabled,
  toBeEnabled,
  toBeEmptyDOMElement,
  toBeInTheDocument,

  // toBeInvalid
  // toBeRequired
  // toBeValid

  toBeVisible,
  toContainElement,
  toContainHTML,

  // toHaveAccessibleDescription
  // toHaveAccessibleErrorMessage

  toHaveAccessibleName,
  toHaveAttribute,

  // toHaveClass

  toHaveFocus,
  toHaveFormValues,

  // toHaveStyle

  toHaveTextContent,
  toHaveValue,
  toHaveDisplayValue,
  toBeChecked,
  toBePartiallyChecked,
  toHaveRole,

  // toHaveErrorMessage
  // toHaveSelection
}
