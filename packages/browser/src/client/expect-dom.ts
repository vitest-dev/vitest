import * as matchers from '@testing-library/jest-dom/matchers'
import type { ExpectPollOptions } from '@vitest/expect'
import { importId } from './utils'

export async function createExpectDom() {
  const { expect } = await importId('vitest') as typeof import('vitest')

  expect.extend(matchers)
  expect.dom = <T extends Element>(element: T, options?: ExpectPollOptions) => {
    return expect.poll(() => element, options)
  }
}
