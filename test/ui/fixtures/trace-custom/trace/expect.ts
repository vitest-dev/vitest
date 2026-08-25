import type { Locator } from 'playwright'
import type { Assertion, ExpectStatic } from 'vitest'
// @ts-ignore
import { parseStacktrace } from '@vitest/utils/source-map'
import { expect as baseExpect } from 'vitest'
import { getActiveTraceRecorder } from './active'

interface LocatorAssertion extends Assertion<Promise<void>, Locator> {
  toBeVisible: (options?: { timeout?: number }) => Promise<void>
}

type TraceExpect = ExpectStatic & {
  (actual: Locator, message?: string): LocatorAssertion
}

export const expect = new Proxy(baseExpect, {
  apply(target, thisArg, argumentsList) {
    const [actual] = argumentsList
    const assertion = Reflect.apply(target, thisArg, argumentsList)
    if (!isLocator(actual)) {
      return assertion
    }

    return new Proxy(assertion, {
      get(target, key, receiver) {
        if (key !== 'toBeVisible') {
          return Reflect.get(target, key, receiver)
        }

        return async (options?: { timeout?: number }) => {
          const frame = parseStacktrace(new Error().stack ?? '').find(({ file }) => !file.includes('/trace/'))
          const location = frame
            ? { file: frame.file, line: frame.line, column: frame.column }
            : undefined
          await getActiveTraceRecorder().assert(
            'expect.toBeVisible',
            () => baseExpect.poll(() => actual.isVisible(), options).toBe(true),
            { location },
          )
        }
      },
    })
  },
}) as TraceExpect

function isLocator(value: unknown): value is Locator {
  return !!value
    && typeof value === 'object'
    && typeof (value as Locator).isVisible === 'function'
    && typeof (value as Locator).locator === 'function'
}
