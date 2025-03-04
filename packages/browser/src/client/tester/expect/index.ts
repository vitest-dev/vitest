import type { MatchersObject } from '@vitest/expect'
import toBeChecked from './toBeChecked'
import toBeDisabled from './toBeDisabled'
import toBeEmptyDOMElement from './toBeEmptyDOMElement'
import toBeEnabled from './toBeEnabled'
import toBeInTheDocument from './toBeInTheDocument'
import toBePartiallyChecked from './toBePartiallyChecked'
import toHaveAttribute from './toHaveAttribute'
import toHaveValue from './toHaveValue'

export const matchers: MatchersObject = {
  toBeChecked,
  toHaveValue,
  toBePartiallyChecked,
  toBeDisabled,
  toBeInTheDocument,
  toBeEmptyDOMElement,
  toBeEnabled,
  toHaveAttribute,
}
