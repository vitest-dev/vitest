import type { AsyncExpectationResult, MatcherState } from '@vitest/expect'
import type { ScreenshotMatcherOptions } from '../../../../context'
import type { ScreenshotMatcherArguments, ScreenshotMatcherOutput } from '../../../shared/screenshotMatcher/types'
import type { Locator } from '../locators'
import { getCurrentTest } from '@vitest/runner'
import { getBrowserState } from '../../utils'
import { convertElementToCssSelector } from '../utils'
import { getElementFromUserInput } from './utils'

const counters = new Map<string, { current: number }>([])

export default async function toMatchScreenshot(
  this: MatcherState,
  actual: Element | Locator,
  nameOrOptions?: ScreenshotMatcherOptions | string,
  options: ScreenshotMatcherOptions = typeof nameOrOptions === 'object'
    ? nameOrOptions
    : {},
): AsyncExpectationResult {
  if (this.isNot) {
    throw new Error('\'toMatchScreenshot\' cannot be used with "not"')
  }

  const currentTest = getCurrentTest()

  if (currentTest === undefined || this.currentTestName === undefined) {
    throw new Error('\'toMatchScreenshot\' cannot be used without test context')
  }

  const counterName = `${currentTest.result?.repeatCount ?? 0}${this.testPath}${this.currentTestName}`
  let counter = counters.get(counterName)

  if (counter === undefined) {
    counter = { current: 0 }

    counters.set(counterName, counter)
  }

  counter.current += 1

  const name = typeof nameOrOptions === 'string'
    ? nameOrOptions
    : `${this.currentTestName} ${counter.current}`

  const result = await
  getBrowserState().commands.triggerCommand<ScreenshotMatcherOutput>(
    '__vitest_screenshotMatcher',
    [
      name,
      this.currentTestName,
      {
        element: convertElementToCssSelector(
          getElementFromUserInput(actual, toMatchScreenshot, this),
        ),
        ...options,
      },
    ] satisfies ScreenshotMatcherArguments,
  )

  if (result.pass === false) {
    const { annotate } = currentTest.context

    const annotations: ReturnType<typeof annotate>[] = []

    if (result.reference) {
      annotations.push(annotate('Reference screenshot', { path: result.reference }))
    }

    if (result.actual) {
      annotations.push(annotate('Actual screenshot', { path: result.actual }))
    }

    if (result.diff) {
      annotations.push(annotate('Diff', { path: result.diff }))
    }

    await Promise.all(annotations)
  }

  return {
    pass: result.pass,
    message: () =>
      result.pass
        ? ''
        : [
            this.utils.matcherHint('toMatchScreenshot', 'element', ''),
            '',
            result.message,
            result.reference
              ? `\nReference screenshot:\n  ${this.utils.EXPECTED_COLOR(result.reference)}`
              : null,
            result.actual
              ? `\nActual screenshot:\n  ${this.utils.RECEIVED_COLOR(result.actual)}`
              : null,
            result.diff
              ? this.utils.DIM_COLOR(`\nDiff screenshot:\n  ${result.diff}`)
              : null,
          ]
            .filter(element => element !== null)
            .join('\n'),
  }
}
