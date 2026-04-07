import { expect, Snapshots } from "vitest"
import type { MatchersObject } from "@vitest/expect"
import { kvAdapter } from "./basic"

interface CustomMatchers<R = unknown> {
  toMatchKvSnapshot: () => R
  toMatchKvInlineSnapshot: (snapshot?: string) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
}

const matchers: MatchersObject = {
  toMatchKvSnapshot(actual: unknown) {
    return Snapshots.toMatchDomainSnapshot.call(this, kvAdapter, actual)
  },
  toMatchKvInlineSnapshot(
    actual: unknown,
    inlineSnapshot?: string,
  ) {
    return Snapshots.toMatchDomainInlineSnapshot.call(this, kvAdapter, actual, inlineSnapshot)
  },
}

// internal flag to allow expect.poll for snapshot matchers
for (const matcher of Object.values(matchers)) {
  Object.assign(matcher, {
    __vitest_poll_takeover__: true,
  })
}

expect.extend(matchers)
