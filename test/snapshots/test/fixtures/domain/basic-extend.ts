import { toMatchDomainSnapshot, toMatchDomainInlineSnapshot } from "vitest/runtime"
import { kvAdapter } from "./basic"
import { expect } from "vitest"
import { MatchersObject } from "@vitest/expect"

interface CustomMatchers<R = unknown> {
  toMatchKvSnapshot: () => R
  toMatchKvInlineSnapshot: (snapshot?: string) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
}

const matchers: MatchersObject = {
  toMatchKvSnapshot(actual: unknown) {
    return toMatchDomainSnapshot.call(this, kvAdapter, actual)
  },
  toMatchKvInlineSnapshot(
    actual: unknown,
    inlineSnapshot?: string,
  ) {
    return toMatchDomainInlineSnapshot.call(this, kvAdapter, actual, inlineSnapshot)
  },
}

for (const matcher of Object.values(matchers)) {
  Object.assign(matcher, {
    __vitest_poll_takeover__: true,
  });
}

// expect.extend(matchers, {
//   __vitest_poll_takeover__: true,
// })

expect.extend(matchers)
