import type { ExpectPollOptions, PromisifyDomAssertion } from 'vitest'
import type { Locator } from 'vitest/browser'
import { chai, expect } from 'vitest'
import { getType } from 'vitest/internal/browser'
import { matchers } from './expect'
import { processTimeoutOptions } from './tester-utils'

const kLocator = Symbol.for('$$vitest:locator')

function element<T extends HTMLElement | SVGElement | null | Locator>(elementOrLocator: T, options?: ExpectPollOptions): PromisifyDomAssertion<HTMLElement | SVGElement | null> {
  if (elementOrLocator != null && !(elementOrLocator instanceof HTMLElement) && !(elementOrLocator instanceof SVGElement) && !(kLocator in elementOrLocator)) {
    throw new Error(`Invalid element or locator: ${elementOrLocator}. Expected an instance of HTMLElement, SVGElement or Locator, received ${getType(elementOrLocator)}`)
  }

  const expectElement = expect.poll<HTMLElement | SVGElement | null>(function element(this: object) {
    if (elementOrLocator instanceof Element || elementOrLocator == null) {
      return elementOrLocator
    }

    const isNot = chai.util.flag(this, 'negate') as boolean
    const name = chai.util.flag(this, '_name') as string
    // special case for `toBeInTheDocument` matcher
    if (isNot && name === 'toBeInTheDocument') {
      return elementOrLocator.query()
    }
    if (name === 'toHaveLength') {
      // we know that `toHaveLength` requires multiple elements,
      // but types generally expect a single one
      return elementOrLocator.elements() as unknown as HTMLElement
    }

    if (name === 'toMatchScreenshot' && !chai.util.flag(this, '_poll.assert_once')) {
      // `toMatchScreenshot` should only run once after the element resolves
      chai.util.flag(this, '_poll.assert_once', true)
    }

    // element selector uses prettyDOM under the hood, which is an expensive call
    // that should not be called on each failed locator attempt to avoid memory leak:
    // https://github.com/vitest-dev/vitest/issues/7139
    const isLastPollAttempt = chai.util.flag(this, '_isLastPollAttempt')

    if (isLastPollAttempt) {
      return elementOrLocator.element()
    }

    const result = elementOrLocator.query()

    if (!result) {
      throw new Error(`Cannot find element with locator: ${JSON.stringify(elementOrLocator)}`)
    }

    return result
  }, processTimeoutOptions(options))

  chai.util.flag(expectElement, '_poll.element', true)

  return expectElement
}

expect.extend(matchers)
expect.element = element
