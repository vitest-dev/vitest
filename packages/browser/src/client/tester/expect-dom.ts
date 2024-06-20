import * as matchers from '@testing-library/jest-dom/matchers'
import type { ExpectPollOptions } from '@vitest/expect'
import { expect } from 'vitest'

export async function setupExpectDom() {
  expect.extend(matchers)
  expect.dom = <T extends Element>(element: T, options?: ExpectPollOptions) => {
    return expect.poll(() => element, options)
  }
}
