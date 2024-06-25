import * as matchers from '@testing-library/jest-dom/matchers'
import type { ExpectPollOptions } from 'vitest'
import { expect } from 'vitest'

export async function setupExpectDom() {
  expect.extend(matchers)
  expect.element = <T extends Element>(element: T, options?: ExpectPollOptions) => {
    return expect.poll(() => element, options)
  }
}
