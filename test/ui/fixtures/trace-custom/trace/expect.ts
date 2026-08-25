import type { Locator } from 'playwright'
// @ts-ignore
import { parseStacktrace } from '@vitest/utils/source-map'
import { expect } from 'vitest'
import { getActiveTraceRecorder } from './active'

expect.extend({
  async toBeVisible(actual: unknown, options?: { timeout?: number }) {
    if (!isLocator(actual)) {
      throw new TypeError('toBeVisible expects a Playwright Locator')
    }

    const frame = parseStacktrace(new Error().stack ?? '').find(({ file }) => {
      return !file.includes('/node_modules/') && !file.includes('/trace/')
    })
    const location = frame
      ? { file: frame.file, line: frame.line, column: frame.column }
      : undefined
    const isNot = this.isNot
    try {
      await getActiveTraceRecorder().assert(
        `expect.${isNot ? 'not.' : ''}toBeVisible`,
        () => actual.waitFor({
          state: isNot ? 'hidden' : 'visible',
          timeout: options?.timeout,
        }),
        { location },
      )
      return {
        pass: !isNot,
        message: () => `Expected locator ${isNot ? '' : 'not '}to be visible`,
      }
    }
    catch (error) {
      return {
        pass: isNot,
        message: () => error instanceof Error ? error.message : String(error),
      }
    }
  },
})

function isLocator(value: unknown): value is Locator {
  return !!value
    && typeof value === 'object'
    && typeof (value as Locator).isVisible === 'function'
    && typeof (value as Locator).locator === 'function'
}
