import type { AsyncExpectationResult, MatcherState } from '@vitest/expect'
import type { ScreenshotCompareOptions } from '../../../../context'
import type { Locator } from '../locators'

import { basename, dirname, join, resolve } from 'pathe'
import { ensureAwaited, getBrowserState, getWorkerState } from '../../utils'
import { convertToSelector } from '../context'
import { processTimeoutOptions } from '../utils'

function triggerCommand<T>(command: string, args: any[], error?: Error) {
  return getBrowserState().commands.triggerCommand<T>(command, args, error)
}

export default async function toMatchScreenshot(
  this: MatcherState,
  received: Element | Locator,
  options: ScreenshotCompareOptions = {},
): AsyncExpectationResult {
  if (this.isNot) {
    throw new Error('toMatchScreenshot cannot be used with "not"')
  }

  const { currentTestName, testPath } = this
  if (!currentTestName || !testPath) {
    throw new Error('Test name or path undefined')
  }

  const snapshotsDir = dirname(this.snapshotState.snapshotPath)
  const screenshotFileName = `${currentTestName}.png`
  options.baselinePath = options.baselinePath ? resolve(options.baselinePath) : join(snapshotsDir, screenshotFileName)

  options.diffPath = options.diffPath
    ? resolve(options.diffPath)
    : join(
        dirname(options.baselinePath),
        '__diff_images__',
        `${basename(options.baselinePath, '.png')}-diff.png`,
      )

  const updateBaselines = getWorkerState().config.snapshotOptions.updateSnapshot === 'all'
  options.updateBaselines ||= updateBaselines

  return ensureAwaited(error => triggerCommand('__vitest_screenshot_compare', [processTimeoutOptions({
    ...options,
    element: options.element
      ? convertToSelector(received)
      : undefined,
  })], error))
}
