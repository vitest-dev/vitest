import type { Locator } from '@vitest/browser/context'
import type jsdomMatchers from './jest-dom.js'
import type { Assertion, ExpectPollOptions } from 'vitest'

declare module 'vitest' {
  interface JestAssertion<T = any> extends jsdomMatchers.default.TestingLibraryMatchers<void, T> {}
  interface AsymmetricMatchersContaining extends jsdomMatchers.default.TestingLibraryMatchers<void, void> {}

  type Promisify<O> = {
    [K in keyof O]: O[K] extends (...args: infer A) => infer R
      ? O extends R
        ? Promisify<O[K]>
        : (...args: A) => Promise<R>
      : O[K];
  }

  type PromisifyDomAssertion<T> = Promisify<Assertion<T>>

  interface ExpectStatic {
    /**
     * `expect.element(locator)` is a shorthand for `expect.poll(() => locator.element())`.
     * You can set default timeout via `expect.poll.timeout` config.
     */
    element: <T extends Element | Locator>(element: T, options?: ExpectPollOptions) => PromisifyDomAssertion<Awaited<Element | null>>
  }
}

export {}
