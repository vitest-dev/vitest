import type { ExpectationResult, MatcherState } from '@vitest/expect'
import type { Locator } from '../locators'
import { getElementFromUserInput, getMessage, getTag } from './utils'

export default function toHaveTagName(
  this: MatcherState,
  actual: Element | Locator,
  expectedTagName: Lowercase<string>,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toHaveTagName, this)
  const receivedTagName = getTag(htmlElement).toLowerCase()

  if (typeof expectedTagName === 'string') {
    expectedTagName = expectedTagName.toLowerCase() as Lowercase<string>
  }

  return {
    pass: this.equals(receivedTagName, expectedTagName, this.customTesters),
    message: () => {
      const to = this.isNot ? 'not to' : 'to'
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toHaveTagName`,
          'element',
          '',
        ),
        `Expected element ${to} have tag name`,
        expectedTagName,
        'Received',
        receivedTagName,
      )
    },
  }
}
