import type { Locator } from '@vitest/browser/context'
import type { TestingLibraryMatchers } from './jest-dom.js'
import type { Assertion, ExpectPollOptions } from 'vitest'

declare module 'vitest' {
  interface JestAssertion<T = any, R = void> extends TestingLibraryMatchers<T, R> {}
  interface AsymmetricMatchersContaining<T = any, R = void> extends TestingLibraryMatchers<T, R> {}


  type PromisifyDomAssertion<T> = Assertion<T, Promise<void>>

  interface ExpectStatic {
    /**
     * `expect.element(locator)` is a shorthand for `expect.poll(() => locator.element())`.
     * You can set default timeout via `expect.poll.timeout` option in the config.
     * @see {@link https://vitest.dev/api/expect#poll}
     */
    element: <T extends Element | Locator | null>(element: T, options?: ExpectPollOptions) => PromisifyDomAssertion<Awaited<Element | null>>
  }
}

export {}
