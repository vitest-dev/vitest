import * as matchers from '@testing-library/jest-dom/matchers'
import type { Locator } from '@vitest/browser/context'
import type { ExpectPollOptions } from 'vitest'
import { expect } from 'vitest'

export async function setupExpectDom() {
  expect.extend(matchers)
  expect.element = <T extends Element | Locator>(elementOrLocator: T, options?: ExpectPollOptions) => {
    if (!(elementOrLocator instanceof Element) && !('element' in elementOrLocator)) {
      throw new Error(`Invalid element or locator: ${elementOrLocator}`)
    }

    return expect.poll<Element>(() => {
      if (elementOrLocator instanceof Element) {
        return elementOrLocator
      }
      return elementOrLocator.element()
    }, options)
  }
}
