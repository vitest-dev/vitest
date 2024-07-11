import * as matchers from '@testing-library/jest-dom/matchers'
import type { Locator } from '@vitest/browser/context'
import type { ExpectPollOptions } from 'vitest'
import { expect } from 'vitest'

export async function setupExpectDom() {
  expect.extend(matchers)
  expect.element = <T extends Element | Locator>(elementOrLocator: T, options?: ExpectPollOptions) => {
    return expect.poll(() => {
      return elementOrLocator instanceof Element ? elementOrLocator : elementOrLocator.element()!
    }, options) as any
  }
}
