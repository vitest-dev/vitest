import type { ExpectationResult, MatcherState } from '@vitest/expect'
import type { Locator } from '../locators'
import { getElementFromUserInput, getMessage, getSingleElementValue, isInputElement } from './utils'

export default function toHaveValue(
  this: MatcherState,
  actual: Element | Locator,
  expectedValue?: string,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toHaveValue, this)

  if (
    isInputElement(htmlElement)
    && ['checkbox', 'radio'].includes(htmlElement.type)
  ) {
    throw new Error(
      'input with type=checkbox or type=radio cannot be used with .toHaveValue(). Use .toBeChecked() for type=checkbox or .toHaveFormValues() instead',
    )
  }

  const receivedValue = getSingleElementValue(htmlElement)
  const expectsValue = expectedValue !== undefined

  let expectedTypedValue = expectedValue
  let receivedTypedValue = receivedValue
  // eslint-disable-next-line eqeqeq
  if (expectedValue == receivedValue && expectedValue !== receivedValue) {
    expectedTypedValue = `${expectedValue} (${typeof expectedValue})`
    receivedTypedValue = `${receivedValue} (${typeof receivedValue})`
  }

  return {
    pass: expectsValue
      ? this.equals(receivedValue, expectedValue)
      : Boolean(receivedValue),
    message: () => {
      const to = this.isNot ? 'not to' : 'to'
      const matcher = this.utils.matcherHint(
        `${this.isNot ? '.not' : ''}.toHaveValue`,
        'element',
        expectedValue,
      )
      return getMessage(
        this,
        matcher,
        `Expected the element ${to} have value`,
        expectsValue ? expectedTypedValue : '(any)',
        'Received',
        receivedTypedValue,
      )
    },
  }
}
