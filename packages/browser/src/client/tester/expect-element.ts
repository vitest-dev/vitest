import type { Locator } from '@vitest/browser/context'
import type { ExpectPollOptions } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import { chai, expect } from 'vitest'

export async function setupExpectDom() {
  expect.extend(matchers)
  expect.element = <T extends Element | Locator>(elementOrLocator: T, options?: ExpectPollOptions) => {
    if (!(elementOrLocator instanceof Element) && !('element' in elementOrLocator)) {
      throw new Error(`Invalid element or locator: ${elementOrLocator}. Expected an instance of Element or Locator, received ${typeof elementOrLocator}`)
    }

    return expect.poll<Element | null>(function element(this: object) {
      if (elementOrLocator instanceof Element || elementOrLocator == null) {
        return elementOrLocator
      }
      chai.util.flag(this, '_poll.element', true)

      const isNot = chai.util.flag(this, 'negate') as boolean
      const name = chai.util.flag(this, '_name') as string
      // special case for `toBeInTheDocument` matcher
      if (isNot && name === 'toBeInTheDocument') {
        return elementOrLocator.query()
      }
      return elementOrLocator.element()
    }, options)
  }
}
