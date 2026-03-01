import type { AsyncExpectationResult, MatcherState } from '@vitest/expect'
import type { VisualRegressionArtifact } from '@vitest/runner'
import type { ScreenshotMatcherOptions } from '../../../../context'
import type { ScreenshotMatcherArguments, ScreenshotMatcherOutput } from '../../../shared/screenshotMatcher/types'
import type { Locator } from '../locators'
import { recordArtifact } from 'vitest'
import { getBrowserState } from '../../utils'
import { convertToSelector } from '../tester-utils'

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

  if (this.task === undefined || this.currentTestName === undefined) {
    throw new Error('\'toMatchScreenshot\' cannot be used without test context')
  }

  const counterName = `${this.task.result?.repeatCount ?? 0}${this.testPath}${this.currentTestName}`
  let counter = counters.get(counterName)

  if (counter === undefined) {
    counter = { current: 0 }

    counters.set(counterName, counter)
  }

  counter.current += 1

  const name = typeof nameOrOptions === 'string'
    ? nameOrOptions
    : `${this.currentTestName} ${counter.current}`

  const [element, ...mask] = await Promise.all([
    convertToSelector(actual, options),
    ...options.screenshotOptions && 'mask' in options.screenshotOptions
      ? (options.screenshotOptions.mask as Array<Element | Locator>)
          .map(m => convertToSelector(m, options))
      : [],
  ])

  const normalizedOptions: Omit<ScreenshotMatcherArguments[2], 'element'> = (
    options.screenshotOptions && 'mask' in options.screenshotOptions
      ? {
          ...options,
          screenshotOptions: {
            ...options.screenshotOptions,
            mask,
          },
        }
      // TS believes `mask` to still be defined as `ReadonlyArray<Element | Locator>`
      : options as any
  )

  const result = await getBrowserState().commands.triggerCommand<ScreenshotMatcherOutput>(
    '__vitest_screenshotMatcher',
    [
      name,
      this.currentTestName,
      {
        element,
        ...normalizedOptions,
      },
    ] satisfies ScreenshotMatcherArguments,
  )

  if (result.pass === false) {
    const attachments: VisualRegressionArtifact['attachments'] = []

    if (result.reference) {
      attachments.push({ name: 'reference', ...result.reference })
    }

    if (result.actual) {
      attachments.push({ name: 'actual', ...result.actual })
    }

    if (result.diff) {
      attachments.push({ name: 'diff', ...result.diff })
    }

    if (attachments.length > 0) {
      await recordArtifact(this.task, {
        type: 'internal:toMatchScreenshot',
        kind: 'visual-regression',
        message: result.message,
        attachments,
      })
    }
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
              ? `\nReference screenshot:\n  ${this.utils.EXPECTED_COLOR(result.reference.path)}`
              : null,
            result.actual
              ? `\nActual screenshot:\n  ${this.utils.RECEIVED_COLOR(result.actual.path)}`
              : null,
            result.diff
              ? this.utils.DIM_COLOR(`\nDiff image:\n  ${result.diff.path}`)
              : null,
            '',
          ]
            .filter(element => element !== null)
            .join('\n'),
  }
}
