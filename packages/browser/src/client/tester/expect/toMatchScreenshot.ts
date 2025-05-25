import type { AsyncExpectationResult, MatcherState } from '@vitest/expect'
import type { Locator } from '../locators'
import { commands, page } from '@vitest/browser/context'
import { dirname } from 'pathe'

export interface ScreenshotOptions {
  threshold?: number
  // other options that might be needed
}

export default async function toMatchScreenshot(
  this: MatcherState,
  received: Element | Locator,
  _options: ScreenshotOptions = {},
): AsyncExpectationResult {
  if (this.isNot) {
    throw new Error('toMatchScreenshot cannot be used with "not"')
  }

  // Create a unique name for the screenshot
  const { currentTestName, testPath } = this
  if (!currentTestName || !testPath) {
    throw new Error('Test name or path undefined')
  }

  const snapshotsDir = dirname(this.snapshotState.snapshotPath)
  const currentPath = `${snapshotsDir}/current/${currentTestName}.png`
  const { base64 } = await page.screenshot({
    path: currentPath,
    element: received,
    base64: true,
  })

  const referencePath = `${snapshotsDir}/reference/${currentTestName}.png`

  const file = await this.snapshotState.environment.resolveRawPath(testPath, referencePath)
  const content = await this.snapshotState.environment.readSnapshotFile(file) ?? undefined

  const rawSnapshot = { file, content, isScreenshot: true }

  const { key, pass } = this.snapshotState.match({
    received: base64,
    testId: currentTestName,
    testName: currentTestName,
    isInline: false,
    rawSnapshot,
  })

  return {
    pass,
    message: () => `Screenshot ${key} ${pass ? 'matches' : 'does not match'} reference`,
  }
}
