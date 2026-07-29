import type { Locator } from './context.js'
import type { TestingLibraryMatchers } from './jest-dom.js'
import type { Assertion, ExpectPollOptions } from 'vitest'

declare module 'vitest' {
  interface Assertion<R, T> extends TestingLibraryMatchers<R, T> {}

  interface ExpectStatic {
    /**
     * `expect.element(locator)` retries locator resolution and DOM assertions
     * using the `expect.poll` timeout options.
     * You can set default timeout via `expect.poll.timeout` option in the config.
     * @see {@link https://vitest.dev/api/expect#poll}
     */
    element: <T extends HTMLElement | SVGElement | null | Locator>(element: T, options?: ExpectPollOptions) => Assertion<
      Promise<void>,
      HTMLElement | SVGElement | null
    >
  }
}

export {}
