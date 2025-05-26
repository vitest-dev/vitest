import type { ScreenshotMatcherOptions } from '@vitest/browser/context'
import type { AsyncExpectationResult, MatcherState } from '@vitest/expect'
import type { ScreenshotMatcherArguments, ScreenshotMatcherOutput } from '../../../node/commands/screenshotMatcher'
import type { Locator } from '../locators'
import { deepMerge } from '@vitest/utils'
import { ensureAwaited, getBrowserState } from '../../utils'
import { convertToSelector } from '../context'
import { getMessage } from './utils'

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
  actual: Locator,
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

  const result = await ensureAwaited(error =>
    getBrowserState().commands.triggerCommand<ScreenshotMatcherOutput>(
      '__vitest_screenshotMatcher',
      [
        name,
        deepMerge<ScreenshotMatcherArguments[1]>(
          {
            element: convertToSelector(actual),
            timeout: 5_000,
          } satisfies Omit<
            ScreenshotMatcherArguments[1],
            'comparatorOptions' | 'screenshotOptions'
          > as any,
          defaultOptions,
          options,
        ),
      ] satisfies ScreenshotMatcherArguments,
      error,
    ))

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
