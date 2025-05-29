import type { AsyncExpectationResult, MatcherState } from '@vitest/expect'
import type { ScreenshotMatcherOptions } from '../../../../context'
import type { ScreenshotMatcherArguments, ScreenshotMatcherOutput } from '../../../shared/screenshotMatcher/types'
import type { Locator } from '../locators'
import { deepMerge } from '@vitest/utils'
import { getBrowserState } from '../../utils'
import { convertElementToCssSelector } from '../utils'
import { getElementFromUserInput, getMessage } from './utils'

const defaultOptions = {
  comparatorOptions: {
    name: 'pixelmatch',
  },
  screenshotOptions: {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    omitBackground: false,
    scale: 'css',
  },
} satisfies ScreenshotMatcherOptions<'pixelmatch'>

export default async function toMatchScreenshot(
  this: MatcherState,
  actual: Element | Locator,
  nameOrOptions?: ScreenshotMatcherOptions | string,
  options: ScreenshotMatcherOptions = typeof nameOrOptions === 'object'
    ? nameOrOptions
    : defaultOptions,
): AsyncExpectationResult {
  if (this.isNot) {
    throw new Error('\'toMatchScreenshot\' cannot be used with "not"')
  }

  if (this.currentTestName === undefined) {
    throw new Error('\'toMatchScreenshot\' cannot be used without test context')
  }

  // @todo add a counter after the name
  const name
      = typeof nameOrOptions === 'string' ? nameOrOptions : this.currentTestName

  const result = await
  getBrowserState().commands.triggerCommand<ScreenshotMatcherOutput>(
    '__vitest_screenshotMatcher',
    [
      name,
      deepMerge<ScreenshotMatcherArguments[1]>(
        {
          element: convertElementToCssSelector(
            getElementFromUserInput(actual, toMatchScreenshot, this),
          ),
          timeout: 5_000,
        } satisfies Omit<
          ScreenshotMatcherArguments[1],
              'comparatorOptions' | 'screenshotOptions'
        > as any,
        defaultOptions,
        options,
      ),
    ] satisfies ScreenshotMatcherArguments,
  )

  let message = ''

  if (result.pass === false) {
    message = getMessage(
      this,
      'toMatchScreenshot',
      `${result.message}${result.reference ? '\nReference screenshot:' : ''}`,
      result.reference,
      result.actual ? 'Actual screenshot:' : '',
      result.actual,
    )

    // @todo use annotate to log diff images: https://github.com/vitest-dev/vitest/pull/7953
  }

  return {
    pass: result.pass,
    message: () =>
      message,
  }
}
