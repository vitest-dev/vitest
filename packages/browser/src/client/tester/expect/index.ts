import type { MatchersObject } from '@vitest/expect'
import toBeChecked from './toBeChecked'
import toBeEmptyDOMElement from './toBeEmptyDOMElement'
import { toBeDisabled, toBeEnabled } from './toBeEnabled'
import toBeInTheDocument from './toBeInTheDocument'
import { toBeInvalid, toBeValid } from './toBeInvalid'
import toBePartiallyChecked from './toBePartiallyChecked'
import toBeRequired from './toBeRequired'
import toBeVisible from './toBeVisible'
import toContainElement from './toContainElement'
import toContainHTML from './toContainHTML'
import toHaveAccessibleDescription from './toHaveAccessibleDescription'
import toHaveAccessibleErrorMessage from './toHaveAccessibleErrorMessage'
import toHaveAccessibleName from './toHaveAccessibleName'
import toHaveAttribute from './toHaveAttribute'
import toHaveClass from './toHaveClass'
import toHaveDisplayValue from './toHaveDisplayValue'
import toHaveFocus from './toHaveFocus'
import toHaveFormValues from './toHaveFormValues'
import toHaveRole from './toHaveRole'
import toHaveSelection from './toHaveSelection'
import toHaveStyle from './toHaveStyle'
import toHaveTextContent from './toHaveTextContent'
import toHaveValue from './toHaveValue'
import toMatchScreenshot from './toMatchScreenshot'

export const matchers: MatchersObject = {
  toBeDisabled,
  toBeEnabled,
  toBeEmptyDOMElement,
  toBeInTheDocument,
  toBeInvalid,
  toBeRequired,
  toBeValid,
  toBeVisible,
  toContainElement,
  toContainHTML,
  toHaveAccessibleDescription,
  toHaveAccessibleErrorMessage,
  toHaveAccessibleName,
  toHaveAttribute,
  toHaveClass,
  toHaveFocus,
  toHaveFormValues,
  toHaveStyle,
  toHaveTextContent,
  toHaveValue,
  toHaveDisplayValue,
  toBeChecked,
  toBePartiallyChecked,
  toHaveRole,
  toHaveSelection,
  toMatchScreenshot,
}
