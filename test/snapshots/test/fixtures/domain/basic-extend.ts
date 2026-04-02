import { toMatchDomainSnapshot, toMatchDomainInlineSnapshot } from "vitest/runtime"
import { kvAdapter } from "./basic"
import { expect } from "vitest"

interface CustomMatchers<R = unknown> {
  toMatchKvSnapshot: () => R
  toMatchKvInlineSnapshot: (snapshot?: string) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
}

expect.extend({
  toMatchKvSnapshot(actual: unknown) {
    return toMatchDomainSnapshot.call(this, kvAdapter, actual)
  },
  toMatchKvInlineSnapshot(
    actual: unknown,
    inlineSnapshot?: string,
  ) {
    return toMatchDomainInlineSnapshot.call(this, kvAdapter, actual, inlineSnapshot)
  },
})
