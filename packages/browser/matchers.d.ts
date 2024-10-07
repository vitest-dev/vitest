import type { Locator } from '@vitest/browser/context'
import type jsdomMatchers from './jest-dom.js'
import type { Assertion } from 'vitest'

declare module 'vitest' {
  interface JestAssertion<T = any> extends jsdomMatchers.default.TestingLibraryMatchers<void, T> {}

  type Promisify<O> = {
    [K in keyof O]: O[K] extends (...args: infer A) => infer R
      ? O extends R
        ? Promisify<O[K]>
        : (...args: A) => Promise<R>
      : O[K];
  }

  type PromisifyDomAssertion<T> = Promisify<Assertion<T>>

  interface ExpectStatic {
    element: <T extends Element | Locator>(element: T, options?: ExpectPollOptions) => PromisifyDomAssertion<Awaited<Element | null>>
  }
}

export {}
