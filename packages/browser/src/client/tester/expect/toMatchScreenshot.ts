import type { AsyncExpectationResult, MatcherState } from '@vitest/expect'
import { ScreenshotCompareResult, type ResolvedScreenshotCompareOptions, type ScreenshotCompareOptions } from '../../../../context'
import type { Locator } from '../locators'

import { basename, dirname, join, resolve } from 'pathe'
import { ensureAwaited, getBrowserState, getWorkerState } from '../../utils'
import { convertToSelector } from '../context'
import { processTimeoutOptions } from '../utils'

function triggerCommand<T>(command: string, ...args: any[]): Promise<T> {
  const commands = getBrowserState().commands
  return ensureAwaited(error => commands.triggerCommand<T>(
    command,
    args,
    error,
  ))
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
  const defaultScreenshotName = `${currentTestName.replace(/[^a-z0-9]/gi, '-')}.png`

  const resolvedOptions = resolveOptions(
    received,
    snapshotsDir,
    defaultScreenshotName,
    options,
  )

  const {pass, message} = await triggerCommand<ScreenshotCompareResult>(
    '__vitest_screenshot_compare',
    processTimeoutOptions({
      ...resolvedOptions,
      element: convertToSelector(received),
    })
  )

  return { pass, message: () => message }
}

function resolveOptions(
  received: Element | Locator,
  snapshotsDir: string,
  defaultScreenshotName: string,
  options: ScreenshotCompareOptions,
): ResolvedScreenshotCompareOptions {
  const baselinePath = options.baselinePath
    ? resolve(options.baselinePath)
    : join(snapshotsDir, defaultScreenshotName)

  return {
    element: received,
    baselinePath,
    diffPath: options.diffPath
      ? resolve(options.diffPath)
      : join(
          dirname(baselinePath),
          '__diff_images__',
          `${basename(baselinePath, '.png')}-diff.png`,
        ),
    pixelMatchThreshold: options.pixelMatchThreshold || 0.1,
    failureThreshold: options.failureThreshold || 0,
    failureThresholdType: options.failureThresholdType || 'pixel',
    updateBaselines: options.updateBaselines || getWorkerState().config.snapshotOptions.updateSnapshot === 'all',
  }
}
